/* OAuth-bound consent remains in the original browser window.
 * The official site picker is on a separate origin, so accept only messages
 * from the exact popup opened by a user gesture and validate the one-use code.
 */
(() => {
  const button = document.getElementById("choose-official-site");
  const form = document.getElementById("official-site-authorization");
  const codeField = form?.querySelector('input[name="code"]');
  if (!button || !form || !codeField) return;
  let picker = null;
  button.addEventListener("click", () => {
    picker = window.open("https://tsumu.ebii.net/mcp/choose", "tsumu-official-picker");
    if (!picker) {
      window.alert("Allow popups to choose a Tsumu site.");
      return;
    }
    picker.focus();
  });
  window.addEventListener("message", event => {
    if (event.origin !== "https://tsumu.ebii.net" || event.source !== picker ||
        event.data?.type !== "tsumu-mcp-site-selected" ||
        typeof event.data.code !== "string" ||
        !/^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/.test(event.data.code)) return;
    picker = null;
    button.disabled = true;
    codeField.value = event.data.code;
    form.requestSubmit();
  });
})();
