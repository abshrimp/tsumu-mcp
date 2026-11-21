import { brand } from "./consent-page.js";
import { guideMessages } from "./guide-locales.js";
import { guideStyles } from "./guide-style.js";
import { GUIDE_MODE, PLUGIN_CLIENTS, pluginIconPath, pluginLinks, safePluginUrl } from "./guide-links.js";
import { MCP_URL, manualGuideMessages } from "./manual-guide-locales.js";

const TSUMU_URL = "https://tsumu.ebii.net";
const REPO_URL = "https://github.com/abshrimp/tsumu-mcp";

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => "&#" + char.charCodeAt(0) + ";");

// Pixel sizes of the screenshots in public/guide/<locale>/ (captured at 2x).
// width/height attributes reserve space so the page doesn't shift while loading.
const SHOTS = {
  ja: { menu: [1280, 520], modal: [1080, 884], connected: [1080, 1060], "consent-new": [1016, 1052], "consent-code": [1016, 1490], import: [960, 600] },
  en: { menu: [1280, 520], modal: [1080, 860], connected: [1080, 1032], "consent-new": [1016, 1052], "consent-code": [1016, 1490], import: [960, 600] },
};
const NARROW_SHOTS = new Set(["modal", "connected", "consent-new", "consent-code"]);

// Screenshots of each AI app for the manual-setup guide, in public/guide/apps/.
// "all" is one image for both languages (<name>.webp); "ja"/"en" are per
// language (<name>-<locale>.webp). A step whose image isn't listed here is
// shown without one, so a screenshot appears as soon as it is added.
const APP_SHOTS = {};

function appShot(name, locale) {
  const entry = APP_SHOTS[name];
  if (!entry) return null;
  if (entry.all) return { src: "/guide/apps/" + name + ".webp", size: entry.all };
  return entry[locale] ? { src: "/guide/apps/" + name + "-" + locale + ".webp", size: entry[locale] } : null;
}

const appIcon = (id, size) => "<img src='" + pluginIconPath(id) + "' width='" + size + "' height='" + size + "' alt=''>";

const icons = {
  // GitHub mark from @primer/octicons (MIT), for links that open GitHub.
  github: "<svg class='gh' viewBox='0 0 16 16' aria-hidden='true'><path d='M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656'/></svg>",
  external: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'/></svg>",
  arrow: "<svg class='arrow' viewBox='0 0 24 24' aria-hidden='true'><path d='M12 5v14m-6-6 6 6 6-6'/></svg>",
  alert: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'/></svg>",
};

/** One card per AI client: icon, name and a link to its published plugin. */
function clientCard(t, client) {
  const url = safePluginUrl(pluginLinks[client.id]);
  const action = url
    ? "<a class='btn btn-primary' href='" + escapeHtml(url) + "' target='_blank' rel='noopener'>" +
      escapeHtml(t.getPlugin) + icons.external + "</a>"
    // Only reachable before every listing is set; the page is published after that.
    : "<span class='soon'>" + escapeHtml(t.comingSoon) + "</span>";
  return "<article class='app' id='app-" + client.id + "' data-plugin='" + (url ? "available" : "pending") + "'>" +
    "<span class='app-icon' aria-hidden='true'>" + appIcon(client.id, 28) + "</span>" +
    "<div class='app-name'><strong>" + escapeHtml(client.name) + "</strong><span>" +
    escapeHtml(t[client.id + "Summary"]) + "</span></div>" + action + "</article>";
}

const figureHtml = (src, size, alt, narrow) =>
  "<figure><img class='shot" + (narrow ? " shot-narrow" : "") + "' src='" + src + "' width='" + size[0] + "' height='" + size[1] +
  "' alt='" + escapeHtml(alt) + "' loading='lazy' decoding='async'></figure>";

const codeHtml = code => "<pre class='code'><code>" + escapeHtml(code) + "</code></pre>";

function stepHtml(item, figure) {
  return "<li class='step" + (figure ? "" : " no-image") + "'><div><h4>" + escapeHtml(item.title) + "</h4><p>" +
    escapeHtml(item.body) + "</p>" + (item.code ? codeHtml(item.code) : "") + "</div>" + figure + "</li>";
}

function step(locale, item) {
  const size = item.image && SHOTS[locale][item.image];
  return stepHtml(item, size ? figureHtml("/guide/" + locale + "/" + item.image + ".webp", size, item.alt, NARROW_SHOTS.has(item.image)) : "");
}

function appStep(locale, item) {
  const shot = item.image && appShot(item.image, locale);
  return stepHtml(item, shot ? figureHtml(shot.src, shot.size, item.alt, false) : "");
}

/** Plugin mode: one card per app with a link to its published plugin. */
function pluginAppsSection(t) {
  return "<section class='block' id='apps' aria-labelledby='apps-title'><h2 id='apps-title'>" + escapeHtml(t.appsTitle) + "</h2>" +
    "<p class='section-lead'>" + escapeHtml(t.appsLead) + "</p><div class='apps'>" +
    PLUGIN_CLIENTS.map(client => clientCard(t, client)).join("") + "</div></section>";
}

/** Manual mode: the MCP server URL, then step-by-step setup for each app. */

const SETUP_CLIENTS = [
  { id: "chatgpt", name: "ChatGPT", icon: "chatgpt" },
  { id: "claude", name: "Claude", icon: "claude" },
  { id: "cursor", name: "Cursor", icon: "cursor" },
  { id: "vscode", name: "GitHub Copilot / VS Code", icon: "vscode" },
  { id: "claude-code", name: "Claude Code", icon: "claude" },
  { id: "codex", name: "OpenAI Codex", icon: "chatgpt" },
  { id: "gemini", name: "Gemini CLI", icon: "gemini" },
];

const SETUP_COMMANDS = {
  "claude-code": "claude mcp add --transport http tsumu https://mcp.tsumu.ebii.net/mcp",
  codex: "codex mcp add tsumu --url https://mcp.tsumu.ebii.net/mcp",
  gemini: "gemini mcp add --scope user --transport http tsumu https://mcp.tsumu.ebii.net/mcp",
};

const SETUP_LINKS = {
  chatgpt: "https://chatgpt.com/plugins",
  claude: "https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Tsumu&connectorUrl=https%3A%2F%2Fmcp.tsumu.ebii.net%2Fmcp",
  cursor: "cursor://anysphere.cursor-deeplink/mcp/install?name=tsumu&config=eyJ1cmwiOiJodHRwczovL21jcC50c3VtdS5lYmlpLm5ldC9tY3AifQ%3D%3D",
  vscode: "vscode:mcp/install?%7B%22name%22%3A%22tsumu%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.tsumu.ebii.net%2Fmcp%22%7D",
};

const ADDITIONAL_STEPS = {
  ja: {
    vscode: [
      { title: "VS CodeでTsumuを追加", body: "ボタンからMCPサーバーをインストールします。" },
      { title: "接続を承認", body: "認証の確認が出たら許可し、下の共通の認可手順に進みます。" },
    ],
    "claude-code": [
      { title: "ターミナルでコマンドを実行", body: "次のコマンドでTsumuを登録します。" },
      { title: "Claude Codeで /mcp を開く", body: "tsumu を選択して Authenticate を押します。" },
    ],
    codex: [
      { title: "ターミナルでコマンドを実行", body: "次のコマンドでTsumuを登録します。" },
      { title: "ブラウザで認可", body: "表示された認可画面でアクセスするサイトを選択します。" },
    ],
  },
  en: {
    vscode: [
      { title: "Add Tsumu in VS Code", body: "Use the button to install the MCP server." },
      { title: "Approve the connection", body: "Allow authentication, then follow the common authorization steps below." },
    ],
    "claude-code": [
      { title: "Run the terminal command", body: "Register Tsumu with the following command." },
      { title: "Open /mcp in Claude Code", body: "Select tsumu, then choose Authenticate." },
    ],
    codex: [
      { title: "Run the terminal command", body: "Register Tsumu with the following command." },
      { title: "Authorize in the browser", body: "Choose the sites to permit on the authorization page." },
    ],
  },
};

function setupClientSteps(locale, m, client) {
  if (client.id === "gemini") return m.clients.gemini.steps;
  if (m.clients[client.id]) return m.clients[client.id].steps;
  return ADDITIONAL_STEPS[locale][client.id];
}

function setupClientCard(locale, m, client) {
  const steps = setupClientSteps(locale, m, client);
  const link = SETUP_LINKS[client.id];
  const command = SETUP_COMMANDS[client.id];
  const action = link
    ? "<p class='setup-action'><a class='btn btn-primary' href='" + escapeHtml(link) + "'" +
      (link.startsWith("https:") ? " target='_blank' rel='noopener noreferrer'" : "") + ">" +
      escapeHtml(locale === "ja" ? "接続設定を開く" : "Open setup") + icons.external + "</a></p>"
    : "";
  const stepsHtml = steps.map((item, index) => {
    const cmd = command && index === 0 ? codeHtml(command) : "";
    return "<li class='step no-image'><div><h4>" + escapeHtml(item.title) + "</h4><p>" +
      escapeHtml(item.body) + "</p>" + (item.code ? codeHtml(item.code) : cmd) + "</div></li>";
  }).join("");
  return "<details class='setup-client' id='app-" + client.id + "'><summary><span class='app-icon'>" +
    appIcon(client.icon, 28) + "</span><strong>" + escapeHtml(client.name) +
    "</strong><span class='setup-chevron' aria-hidden='true'>⌄</span></summary>" +
    "<div class='setup-client-body'>" + action + "<ol class='steps'>" + stepsHtml +
    "</ol></div></details>";
}

/** The bundled setup guide is organized as collapsible client-specific instructions. */
function manualAppsSection(locale, m) {
  return "<section class='block' id='apps' aria-labelledby='apps-title'><h2 id='apps-title'>" +
    escapeHtml(locale === "ja" ? "1. AIアプリを選ぶ" : "1. Choose your AI app") + "</h2>" +
    "<p class='section-lead'>" + escapeHtml(m.appsLead) + "</p>" +
    "<div class='setup-clients'>" + SETUP_CLIENTS.map(client => setupClientCard(locale, m, client)).join("") + "</div>" +
    "<div class='url-box'><span class='url-label'>" + escapeHtml(m.urlLabel) +
    "</span>" + codeHtml(MCP_URL) + "<span class='url-help'>" + escapeHtml(m.urlHelp) + "</span></div></section>";
}

function flow(locale, id, title, items, note) {
  return "<div class='flow' id='" + id + "'><h3>" + escapeHtml(title) + "</h3><ol class='steps'>" +
    items.map(item => step(locale, item)).join("") + "</ol>" +
    "<p class='note'>" + icons.alert + "<span>" + escapeHtml(note) + "</span></p></div>";
}

function languageLinks(locale) {
  return "<nav class='languages' aria-label='Language'>" +
    ["ja", "en"].map(lang => "<a href='/?lang=" + lang + "'" + (lang === locale ? " aria-current='page'" : "") +
      " lang='" + lang + "' hreflang='" + lang + "'>" + (lang === "ja" ? "日本語" : "English") + "</a>").join("") + "</nav>";
}

export function guidePage(locale, mode = GUIDE_MODE) {
  const t = guideMessages[locale] ?? guideMessages.en;
  const manual = mode === "manual" ? manualGuideMessages[locale] ?? manualGuideMessages.en : null;
  const trouble = manual ? [manual.firstTrouble, ...t.trouble.slice(1)] : t.trouble;
  const body =
    "<a class='skip' href='#content'>" + escapeHtml(t.skip) + "</a>" +
    "<header class='top'><div class='top-inner'><a class='brand' href='/'>" + brand + "<span>Tsumu</span></a>" +
      languageLinks(locale) + "</div></header>" +
    "<main id='content'>" +
      "<section class='hero'><div><p class='eyebrow'>" + escapeHtml(t.eyebrow) + "</p><h1>" + escapeHtml(t.title) + "</h1>" +
        "<p class='lead'>" + escapeHtml(manual ? manual.lead : t.lead) + "</p><div class='actions'>" +
        "<a class='btn btn-primary' href='#apps'>" + escapeHtml(t.tocApps) + "</a>" +
        "<a class='btn' href='" + TSUMU_URL + "'>" + escapeHtml(t.openTsumu) + "</a>" +
        "<a class='btn' href='" + REPO_URL + "'>" + icons.github + escapeHtml(t.viewSource) + "</a></div></div>" +
        "<div class='hero-apps'><p class='works-with'>" + escapeHtml(t.worksWith) + "</p><ul class='app-row'>" +
          (manual ? SETUP_CLIENTS : PLUGIN_CLIENTS).map(client => "<li><a href='#app-" + client.id + "'>" + appIcon(client.icon || client.id, 22) +
            "<span>" + escapeHtml(client.name) + "</span></a></li>").join("") + "</ul></div></section>" +
      "<nav aria-label='" + escapeHtml(t.tocLabel) + "'><ul class='toc'>" +
        [["apps", t.tocApps], ["new-site", t.tocNew], ["edit-site", t.tocEdit], ["trouble", t.tocTrouble]]
          .map(([id, label]) => "<li><a href='#" + id + "'>" + escapeHtml(label) + "</a></li>").join("") + "</ul></nav>" +
      (manual ? manualAppsSection(locale, manual) : pluginAppsSection(t)) +
      "<section class='block' id='choose' aria-labelledby='choose-title'><h2 id='choose-title'>" + escapeHtml(t.chooseTitle) + "</h2>" +
        "<p class='section-lead'>" + escapeHtml(t.chooseLead) + "</p><div class='choices'>" +
        "<a class='choice' href='#new-site'><span class='tag'>" + escapeHtml(t.recommendedFirst) + "</span><h3>" + escapeHtml(t.newCardTitle) + "</h3>" +
          "<p>" + escapeHtml(t.newCardBody) + "</p>" + icons.arrow + "</a>" +
        "<a class='choice' href='#edit-site'><span class='tag'>Tsumu</span><h3>" + escapeHtml(t.editCardTitle) + "</h3>" +
          "<p>" + escapeHtml(t.editCardBody) + "</p>" + icons.arrow + "</a></div>" +
        flow(locale, "new-site", t.newTitle, t.newSteps, t.newNote) +
        flow(locale, "edit-site", t.editTitle, t.editSteps, t.editNote) + "</section>" +
      "<section class='block' id='trouble' aria-labelledby='trouble-title'><h2 id='trouble-title'>" + escapeHtml(t.troubleTitle) + "</h2>" +
        "<div class='faq'>" + trouble.map(([q, a]) => "<details><summary>" + escapeHtml(q) + "</summary><p>" + escapeHtml(a) + "</p></details>").join("") + "</div></section>" +
      "<section class='block' aria-labelledby='security-title'><h2 id='security-title'>" + escapeHtml(t.securityTitle) + "</h2>" +
        "<ul class='safety'>" + t.security.map(item => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul></section>" +
    "</main>" +
    "<footer><div class='foot'><span>" + escapeHtml(t.footerLicense) + "</span><nav>" +
      "<a href='" + REPO_URL + "/blob/main/docs/PRIVACY.md'>" + icons.github + escapeHtml(t.footerPrivacy) + "</a>" +
      "<a href='" + REPO_URL + "'>" + icons.github + escapeHtml(t.footerSource) + "</a>" +
      "<a href='" + TSUMU_URL + "'>Tsumu</a></nav></div></footer>";

  return "<!doctype html><html lang='" + locale + "'><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>" + escapeHtml(t.pageTitle) + "</title>" +
    "<meta name='description' content='" + escapeHtml(t.description) + "'>" +
    "<link rel='canonical' href='https://mcp.tsumu.ebii.net/?lang=" + locale + "'>" +
    "<link rel='alternate' hreflang='ja' href='https://mcp.tsumu.ebii.net/?lang=ja'>" +
    "<link rel='alternate' hreflang='en' href='https://mcp.tsumu.ebii.net/?lang=en'>" +
    "<link rel='icon' type='image/png' href='/favicon.png'>" +
    "<link rel='icon' type='image/svg+xml' href='/favicon.svg'>" +
    "<style>" + guideStyles + "</style></head><body>" + body + "</body></html>";
}

// The guide has no scripts at all.
export const guideCsp = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function guideResponse(locale, method = "GET", mode = GUIDE_MODE) {
  return new Response(method === "HEAD" ? null : guidePage(locale, mode), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Vary": "Accept-Language",
      "Content-Language": locale,
      "Content-Security-Policy": guideCsp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
