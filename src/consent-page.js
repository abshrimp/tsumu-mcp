import { consentMessages } from "./consent-locales.js";
import { consentStyles } from "./consent-style.js";

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => "&#" + char.charCodeAt(0) + ";");

// Recognize only exact, trusted service domains (or their subdomains). Never
// derive an image URL from an untrusted OAuth client name or domain.
// Icons are bundled in public/plugin-icons/ and served from this origin, so the
// page doesn't depend on third-party image hosts staying reachable.
const CLIENT_ICONS = [
  { domain: "chatgpt.com", url: "/plugin-icons/chatgpt.svg" },
  { domain: "openai.com", url: "/plugin-icons/chatgpt.svg" },
  { domain: "claude.ai", url: "/plugin-icons/claude.svg" },
  { domain: "anthropic.com", url: "/plugin-icons/claude.svg" },
  { domain: "cursor.com", url: "/plugin-icons/cursor.svg" },
  { domain: "vscode.dev", url: "/plugin-icons/vscode.svg" },
];

// A registered OAuth callback is not proof of client identity.
// Cursor's fixed callback can still be depicted without claiming verification.
const CURSOR_CALLBACK = "https://www.cursor.com/agents/mcp/oauth/callback";
const isCursorCallback = details => !details.clientDomain &&
  String(details.clientName || "").trim().toLowerCase() === "cursor" &&
  details.redirectUri === CURSOR_CALLBACK;

function clientIcon(details) {
  const host = String(details.clientDomain || "").toLowerCase().replace(/\.$/, "");
  const icon = CLIENT_ICONS.find(item => host === item.domain || host.endsWith("." + item.domain)) ||
    (isCursorCallback(details) ? { url: "/plugin-icons/cursor.svg" } : null);
  const firstCharacter = Array.from(String(details.clientName || "?"))[0] || "?";
  const fallback = escapeHtml(firstCharacter.toLocaleUpperCase());
  if (icon) {
    // Text remains behind the image if an icon URL becomes unavailable.
    return "<span class='client-icon client-icon-fallback' aria-hidden='true'>" +
      fallback + "<img src='" + icon.url +
      "' width='30' height='30' alt=''></span>";
  }
  return "<span class='client-icon client-icon-fallback' aria-hidden='true'>" +
    fallback + "</span>";
}

function languageLink(request, lang) {
  const url = new URL(request.url);
  url.searchParams.set("lang", lang);
  return escapeHtml(url.pathname + url.search);
}

export const brand = "<img class='brand-mark' src='/favicon.svg' alt=''>";

function layout(locale, content, request) {
  const t = consentMessages[locale];
  const languages = request
    ? "<nav class='languages' aria-label='Language'>" +
      ["ja", "en"].map(lang => "<a href='" + languageLink(request, lang) + "'" +
        (lang === locale ? " aria-current='page'" : "") +
        " lang='" + lang + "' hreflang='" + lang + "'>" +
        (lang === "ja" ? "日本語" : "English") + "</a>").join("") + "</nav>"
    : "";
  return "<!doctype html><html lang='" + locale + "'><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>" + escapeHtml(t.pageTitle) + "</title>" +
    "<link rel='icon' type='image/png' href='/favicon.png'>" +
    "<link rel='icon' type='image/svg+xml' href='/favicon.svg'>" +
    "<style>" + consentStyles + "</style></head>" +
    "<body><main class='page'><section class='card'>" +
    "<header class='top'><div class='brand'>" + brand + "<strong>Tsumu</strong></div>" +
    languages + "</header>" + content + "</section></main></body></html>";
}

export function consentPage(details, handle, request, locale) {
  const t = consentMessages[locale];
  const identity = details.clientDomain
    ? escapeHtml(t.verifiedDomain) + escapeHtml(details.clientDomain)
    : isCursorCallback(details)
      ? escapeHtml(t.redirect) + ": " + escapeHtml(details.redirectHost) +
        " · " + escapeHtml(t.unverifiedShort)
      : escapeHtml(t.unverifiedDomain);
  const scopes = details.scope.map(scope => "<li>" + escapeHtml(scope) + "</li>").join("");
  const loopback = details.redirectIsLoopback
    ? "<p class='loopback'>" + escapeHtml(t.loopback) + "</p>" : "";

  const form = controls => "<form method='post' action='/authorize'>" +
    "<input type='hidden' name='handle' value='" + escapeHtml(handle) + "'>" +
    "<input type='hidden' name='lang' value='" + locale + "'>" + controls + "</form>";
  const codeControls = form(
    "<label for='code'>" + escapeHtml(t.code) + "</label>" +
    "<input class='code' id='code' name='code' type='text' inputmode='text' autocomplete='off' autocapitalize='characters' maxlength='40' spellcheck='false' aria-describedby='code-help' required>" +
    "<p class='help' id='code-help'>" + escapeHtml(t.codeHelp) + "</p>" +
    "<button class='approve' type='submit' name='decision' value='approve'>" + escapeHtml(t.approve) + "</button>");
  const draftControls = form("<button class='draft' type='submit' name='decision' value='draft'>" +
    escapeHtml(t.draftOnly) + "</button>");
  // Only display this panel once the official editor reports a nonempty
  // same-origin site directory through a strictly scoped postMessage.
  const officialControls =
    "<section id='official-sites' class='official-sites' hidden>" +
      "<div class='option-heading'><strong>" + escapeHtml(t.existingSite) + "</strong>" +
        "<span>" + escapeHtml(t.chooseOfficial) + "</span></div>" +
      "<form method='post' action='/authorize' id='official-site-authorization'>" +
        "<input type='hidden' name='handle' value='" + escapeHtml(handle) + "'>" +
        "<input type='hidden' name='lang' value='" + locale + "'>" +
        "<input type='hidden' name='decision' value='approve'>" +
        "<input type='hidden' name='codes' value=''>" +
        "<div id='official-site-list' class='official-site-list' role='group' aria-label='" +
          escapeHtml(t.chooseOfficial) + "'></div>" +
        "<label class='official-edit'><input id='official-edit' type='checkbox' checked> " +
          escapeHtml(t.allowEdit) + "</label>" +
        "<p id='official-site-error' class='error' role='alert' hidden></p>" +
        "<button class='approve' id='approve-selected-sites' type='button' disabled>" +
          escapeHtml(t.approveSelectedSites) + "</button>" +
      "</form>" +
    "</section>" +
    "<iframe id='official-site-directory' title='Tsumu site directory' hidden " +
      "referrerpolicy='no-referrer' aria-hidden='true' tabindex='-1'></iframe>";
  const choices = officialControls +
    "<div class='draft-choice'>" +
      "<div class='option-heading'><strong>" + escapeHtml(t.newSite) + "</strong>" +
        "<span>" + escapeHtml(t.newSiteHelp) + "</span></div>" +
      draftControls + "</div>" +
    "<details class='code-option'><summary>" +
      escapeHtml(t.codeOption) + "</summary><div class='code-content'>" +
      codeControls + "</div></details>";

  return layout(locale,
    "<div class='consent-heading'><h1>" + escapeHtml(t.title) + "</h1>" +
      "<p class='intro'>" + escapeHtml(t.intro) + "</p></div>" +
    "<div class='connection'>" +
      "<div class='client-identity'>" + clientIcon(details) +
        "<div class='client-text'><strong>" + escapeHtml(details.clientName) +
        "</strong><span>" + identity + "</span></div></div>" +
      "<svg class='connection-arrow' viewBox='0 0 24 24' aria-hidden='true'><path d='M4 12h16m-6-6 6 6-6 6'/></svg>" +
      "<span class='destination-icon' aria-label='Tsumu'>" + brand + "</span></div>" +
    choices + form("<button class='deny' type='submit' name='decision' value='deny'>" + escapeHtml(t.deny) + "</button>") +
    "<details class='details'><summary>" + escapeHtml(t.details) + "</summary>" +
      "<dl><div><dt>" + escapeHtml(t.redirect) + "</dt><dd>" + escapeHtml(details.redirectHost) + "</dd></div>" +
      "<div><dt>" + escapeHtml(t.scopes) + "</dt><dd><ul class='scopes'>" + scopes + "</ul></dd></div></dl>" +
      loopback + "<p class='restricted'>" + escapeHtml(t.restricted) + "</p></details>" +
    "<script src='/authorize-site.js' defer></script>",
    request);
}

export function consentErrorPage(locale, key) {
  const t = consentMessages[locale];
  return layout(locale,
    "<h1>" + escapeHtml(t.errorTitle) + "</h1>" +
    "<p class='error' role='alert'>" + escapeHtml(t[key] || t.genericError) + "</p>" +
    "<p class='error-help'>" + escapeHtml(t.errorHelp) + "</p>", null);
}
