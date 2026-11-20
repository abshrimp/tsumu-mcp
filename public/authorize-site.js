/* The official editor shares only non-secret site metadata with this OAuth
 * page. Access is granted separately, when the user selects a site.
 */
(() => {
  const frame = document.getElementById("official-site-directory");
  const section = document.getElementById("official-sites");
  const list = document.getElementById("official-site-list");
  const allowEdit = document.getElementById("official-edit");
  const errorBox = document.getElementById("official-site-error");
  const form = document.getElementById("official-site-authorization");
  const codeField = form?.querySelector('input[name="code"]');
  if (!frame || !section || !list || !allowEdit || !errorBox || !form || !codeField) return;

  const editorOrigin = "https://tsumu.ebii.net";
  const codePattern = /^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/;
  const sitePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(18));
  const nonce = btoa(String.fromCharCode(...nonceBytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const japanese = document.documentElement.lang === "ja";
  let editorWindow = null;
  let selectedId = null;
  let timer = null;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    for (const button of list.querySelectorAll("button")) button.disabled = false;
  }

  function chooseSite(site) {
    if (editorWindow) return;
    selectedId = site.id;
    errorBox.hidden = true;
    const edit = allowEdit.checked && site.canEdit ? "1" : "0";
    editorWindow = window.open(
      editorOrigin + "/sites/" + encodeURIComponent(site.id) + "#mcp-select=" + edit,
      "_blank"
    );
    if (!editorWindow) {
      selectedId = null;
      showError(japanese ? "ポップアップを許可してください。" : "Please allow popups.");
      return;
    }
    for (const button of list.querySelectorAll("button")) button.disabled = true;
    timer = setTimeout(() => {
      editorWindow = null;
      selectedId = null;
      showError(japanese ? "接続を確認できませんでした。" : "Could not confirm the connection.");
    }, 60_000);
  }

  function renderSites(sites) {
    list.replaceChildren();
    const valid = sites.filter(site =>
      site && sitePattern.test(site.id) &&
      typeof site.name === "string" && typeof site.canEdit === "boolean"
    ).slice(0, 200);
    section.hidden = valid.length === 0;
    if (!valid.length) return;
    for (const site of valid) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "official-site-item";
      const name = document.createElement("strong");
      name.textContent = site.name.slice(0, 120);
      const access = document.createElement("small");
      access.textContent = !site.canEdit
        ? (japanese ? "閲覧のみ" : "Read only")
        : (japanese ? "選択" : "Select");
      button.append(name, access);
      button.addEventListener("click", () => chooseSite(site));
      list.append(button);
    }
  }

  window.addEventListener("message", event => {
    if (event.origin !== editorOrigin) return;
    if (event.source === frame.contentWindow &&
        event.data?.type === "tsumu-mcp-sites" && event.data.nonce === nonce &&
        Array.isArray(event.data.sites)) {
      renderSites(event.data.sites);
      return;
    }
    if (event.source !== editorWindow || !selectedId ||
        event.data?.type !== "tsumu-mcp-site-ready" ||
        event.data.siteId !== selectedId) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    editorWindow = null;
    selectedId = null;
    if (event.data.ok !== true || !codePattern.test(event.data.code || "")) {
      showError(japanese ? "サイトに接続できませんでした。" : "Could not connect to this site.");
      return;
    }
    codeField.value = event.data.code;
    form.requestSubmit();
  });

  // Fragment-only nonce; never send browser site data or OAuth credentials
  // in URL queries or broad domain cookies.
  frame.src = editorOrigin + "/mcp/sites-bridge#nonce=" + nonce;
})();
