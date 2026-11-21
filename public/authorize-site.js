/* Only explicitly selected official sites are authorized. The site directory
 * exposes non-secret metadata; each site needs a live, one-time browser pairing.
 */
(() => {
  const frame = document.getElementById("official-site-directory");
  const section = document.getElementById("official-sites");
  const list = document.getElementById("official-site-list");
  const allowEdit = document.getElementById("official-edit");
  const errorBox = document.getElementById("official-site-error");
  const form = document.getElementById("official-site-authorization");
  const codesField = form?.querySelector('input[name="codes"]');
  const approve = document.getElementById("approve-selected-sites");
  if (!frame || !section || !list || !allowEdit || !errorBox || !form || !codesField || !approve) return;

  const editorOrigin = "https://tsumu.ebii.net";
  const codePattern = /^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/;
  const sitePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const maxSites = 12;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(18));
  const nonce = btoa(String.fromCharCode(...nonceBytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const japanese = document.documentElement.lang === "ja";
  const originalButtonLabel = approve.textContent;
  const selected = new Map();
  let queue = null;
  const completed = new Map();
  let activeTab = null;
  let siteTimer = null;
  let flowTimer = null;

  const message = (ja, en) => japanese ? ja : en;
  function showError(ja, en) {
    errorBox.textContent = message(ja, en);
    errorBox.hidden = false;
  }
  function stopFlow() {
    if (siteTimer !== null) clearTimeout(siteTimer);
    if (flowTimer !== null) clearTimeout(flowTimer);
    siteTimer = null;
    flowTimer = null;
    queue = null;
    activeTab = null;
    completed.clear();
    for (const input of list.querySelectorAll("input")) input.disabled = false;
    allowEdit.disabled = false;
    approve.textContent = originalButtonLabel;
    approve.disabled = selected.size === 0;
  }
  function renderSites(sites) {
    if (queue) return;
    list.replaceChildren();
    selected.clear();
    const valid = sites.filter(site =>
      site && typeof site.id === "string" && sitePattern.test(site.id) &&
      typeof site.name === "string" && typeof site.canEdit === "boolean"
    ).filter((site, index, all) => all.findIndex(item => item.id === site.id) === index)
      .slice(0, 200);
    section.hidden = valid.length === 0;
    approve.disabled = true;
    if (!valid.length) return;

    for (const site of valid) {
      const label = document.createElement("label");
      label.className = "official-site-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = site.id;
      input.className = "official-site-checkbox";
      const name = document.createElement("strong");
      name.textContent = site.name.slice(0, 120);
      // The global editing checkbox covers editable sites; only exceptions
      // need a per-site label.
      const access = !site.canEdit ? document.createElement("small") : null;
      if (access) access.textContent = message("閲覧のみ", "Read only");
      input.addEventListener("change", () => {
        if (input.checked && selected.size >= maxSites) {
          input.checked = false;
          showError("一度に選択できるのは12サイトまでです。", "Select up to 12 sites.");
          return;
        }
        if (input.checked) selected.set(site.id, site);
        else selected.delete(site.id);
        errorBox.hidden = true;
        approve.disabled = selected.size === 0;
      });
      label.append(input, name);
      if (access) label.append(access);
      list.append(label);
    }
  }

  function openNextSite() {
    if (!queue || activeTab) return;
    const site = queue[completed.size];
    if (!site) return;
    const edit = allowEdit.checked && site.canEdit ? "1" : "0";
    const tab = window.open(editorOrigin + "/sites/" + encodeURIComponent(site.id) +
      "#mcp-select=" + edit, "_blank");
    if (!tab) {
      showError("サイトを開けませんでした。ポップアップを許可してください。",
        "Could not open the site. Allow popups and retry.");
      approve.disabled = false;
      return;
    }
    activeTab = { window: tab, siteId: site.id };
    approve.disabled = true;
    siteTimer = setTimeout(() => {
      siteTimer = null;
      activeTab = null;
      showError("サイトへの接続を確認できませんでした。エディターを確認してください。",
        "Could not connect the site. Check its editor and retry.");
      approve.disabled = false;
    }, 90_000);
  }

  approve.addEventListener("click", () => {
    if (!queue) {
      if (selected.size === 0) return;
      queue = [...selected.values()];
      for (const input of list.querySelectorAll("input")) input.disabled = true;
      allowEdit.disabled = true;
      // Each popup requires its own user gesture in modern browsers.
      // Keep the first editor's socket alive while the next site is approved.
      flowTimer = setTimeout(() => {
        stopFlow();
        showError("接続の有効期限が切れました。もう一度選択してください。",
          "Site connection codes expired. Restart the selection.");
      }, 8 * 60_000);
    }
    errorBox.hidden = true;
    openNextSite();
  });

  window.addEventListener("message", event => {
    if (event.origin !== editorOrigin) return;
    if (event.source === frame.contentWindow &&
        event.data?.type === "tsumu-mcp-sites" && event.data.nonce === nonce &&
        Array.isArray(event.data.sites)) {
      renderSites(event.data.sites);
      return;
    }
    if (!activeTab || event.source !== activeTab.window ||
        event.data?.type !== "tsumu-mcp-site-ready" ||
        event.data.siteId !== activeTab.siteId) return;
    if (siteTimer !== null) clearTimeout(siteTimer);
    siteTimer = null;
    const siteId = activeTab.siteId;
    activeTab = null;
    if (event.data.ok !== true || typeof event.data.code !== "string" ||
        !codePattern.test(event.data.code)) {
      showError("サイトの接続に失敗しました。エディターを確認してください。",
        "A site could not connect. Check its editor tab.");
      approve.disabled = false;
      return;
    }
    if ([...completed.values()].includes(event.data.code)) {
      showError("接続コードが重複しています。もう一度接続してください。",
        "Duplicate connection code. Please retry.");
      approve.disabled = false;
      return;
    }
    completed.set(siteId, event.data.code);
    if (completed.size === queue.length) {
      if (flowTimer !== null) clearTimeout(flowTimer);
      flowTimer = null;
      codesField.value = JSON.stringify(queue.map(site => completed.get(site.id)));
      approve.disabled = true;
      form.requestSubmit();
      return;
    }
    approve.textContent = message(
      "次のサイトを接続 (" + (completed.size + 1) + "/" + queue.length + ")",
      "Connect next site (" + (completed.size + 1) + "/" + queue.length + ")"
    );
    approve.disabled = false;
  });

  frame.src = editorOrigin + "/mcp/sites-bridge#nonce=" + nonce;
})();
