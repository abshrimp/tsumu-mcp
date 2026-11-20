/* Only explicitly selected official sites are authorized. The site directory
 * exposes non-secret metadata, and every selection needs a live browser pairing.
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
  const selected = new Map();
  const pending = new Map();
  let timer = null;
  let submitting = false;

  function message(ja, en) { return japanese ? ja : en; }
  function showError(ja, en) {
    errorBox.textContent = message(ja, en);
    errorBox.hidden = false;
  }
  function resetBusy() {
    submitting = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending.clear();
    for (const input of list.querySelectorAll("input")) input.disabled = false;
    allowEdit.disabled = false;
    approve.disabled = selected.size === 0;
  }
  function renderSites(sites) {
    if (submitting) return;
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
      const access = document.createElement("small");
      access.textContent = site.canEdit
        ? message("編集可能", "Can edit")
        : message("閲覧のみ", "Read only");
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
      label.append(input, name, access);
      list.append(label);
    }
  }

  approve.addEventListener("click", () => {
    if (submitting || selected.size === 0) return;
    submitting = true;
    errorBox.hidden = true;
    approve.disabled = true;
    allowEdit.disabled = true;
    for (const input of list.querySelectorAll("input")) input.disabled = true;
    const entries = [...selected.values()];
    // Open all tabs during the single user gesture. The browser must keep
    // each editor's socket open until every one-time code is claimed by OAuth.
    for (const site of entries) {
      const edit = allowEdit.checked && site.canEdit ? "1" : "0";
      const tab = window.open(editorOrigin + "/sites/" + encodeURIComponent(site.id) +
        "#mcp-select=" + edit, "_blank");
      if (!tab) {
        resetBusy();
        showError("サイトを開けませんでした。ポップアップを許可してください。",
          "Could not open the selected sites. Allow popups and retry.");
        return;
      }
      pending.set(tab, { siteId: site.id, code: null });
    }
    timer = setTimeout(() => {
      resetBusy();
      showError("サイトへの接続を確認できませんでした。各エディターを確認してください。",
        "Could not connect all sites. Check the editor tabs and retry.");
    }, 90_000);
  });

  window.addEventListener("message", event => {
    if (event.origin !== editorOrigin) return;
    if (event.source === frame.contentWindow &&
        event.data?.type === "tsumu-mcp-sites" && event.data.nonce === nonce &&
        Array.isArray(event.data.sites)) {
      renderSites(event.data.sites);
      return;
    }
    if (!submitting || event.data?.type !== "tsumu-mcp-site-ready") return;
    const expected = pending.get(event.source);
    if (!expected || event.data.siteId !== expected.siteId || expected.code) return;
    if (event.data.ok !== true || typeof event.data.code !== "string" ||
        !codePattern.test(event.data.code)) {
      resetBusy();
      showError("サイトの接続に失敗しました。エディターを確認してください。",
        "A site could not connect. Check its editor tab.");
      return;
    }
    expected.code = event.data.code;
    if ([...pending.values()].some(item => !item.code)) return;
    const codes = [...pending.values()].map(item => item.code);
    if (new Set(codes).size !== codes.length) {
      resetBusy();
      showError("接続コードが重複しています。再接続してください。",
        "Duplicate connection codes. Please retry.");
      return;
    }
    if (timer !== null) clearTimeout(timer);
    timer = null;
    codesField.value = JSON.stringify(codes);
    form.requestSubmit();
  });

  // The nonce only authenticates a same-origin iframe response, not an
  // OAuth grant. Never put pairing codes or OAuth credentials in URLs.
  frame.src = editorOrigin + "/mcp/sites-bridge#nonce=" + nonce;
})();
