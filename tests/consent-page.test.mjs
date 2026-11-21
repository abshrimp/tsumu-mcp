import assert from "node:assert/strict";
import { test } from "node:test";
import { consentLocale, consentErrorKey } from "../src/consent-locales.js";
import { consentPage, consentErrorPage } from "../src/consent-page.js";
import { consentStyles } from "../src/consent-style.js";

const request = (query = "", accept = "") =>
  new Request("https://mcp.tsumu.ebii.net/authorize?client_id=client123&state=abc" + query, {
    headers: { "Accept-Language": accept },
  });
const details = {
  clientName: "AI Client",
  clientDomain: "example.com",
  redirectHost: "example.com",
  redirectIsLoopback: false,
  scope: ["tsumu:access"],
};

test("choose Japanese or English using an explicit selection or browser preferences", () => {
  assert.equal(consentLocale(request("&lang=ja", "en-US")), "ja");
  assert.equal(consentLocale(request("&lang=en", "ja-JP")), "en");
  assert.equal(consentLocale(request("", "ja-JP,ja;q=0.9,en;q=0.8")), "ja");
  assert.equal(consentLocale(request("", "en-US,en;q=0.9,ja;q=0.8")), "en");
  assert.equal(consentLocale(request("", "ja;q=0,en;q=1")), "en");
  assert.equal(consentLocale(request("", "fr,ja;q=0.4,en;q=0.8")), "en");
  assert.equal(consentLocale(request("", "fr")), "en");
  assert.equal(consentLocale(request("&lang=ja"), "en"), "en");
  assert.equal(consentLocale(request("&lang=en"), "ja"), "ja");
  assert.equal(consentLocale(request(), "ja"), "ja");
});

test("the compact page preserves both consent choices and language switching", () => {
  const japanese = consentPage(details, "opaque-handle", request("&lang=ja"), "ja");
  assert.match(japanese, /<html lang='ja'>/);
  assert.match(japanese, /Tsumuへの接続/);
  assert.match(japanese, /サイトを選択/);
  assert.doesNotMatch(japanese, /既存のサイトを接続|既存サイトへのアクセスは許可されません/);
  assert.doesNotMatch(japanese, /class='consent-heading'|class='option-heading'|class='intro'/);
  assert.match(japanese, /接続コード/);
  assert.match(japanese, /接続を許可/);
  assert.match(japanese, /新規サイトの作成のみ許可/);
  assert.match(japanese, /name='decision' value='draft'/);
  assert.match(japanese, /キャンセル/);
  assert.match(japanese, /name='lang' value='ja'/);
  assert.match(japanese, /name='decision' value='approve'/);
  assert.match(japanese, /name='decision' value='deny'/);
  assert.match(japanese, /--accent: #0b57d0/);
  assert.match(japanese, /<img class='brand-mark' src='\/favicon\.svg' alt=''>/);
  assert.match(japanese, /<details class='details'>/);
  assert.doesNotMatch(japanese, /class='mock'/);
  assert.doesNotMatch(japanese, /class='visual'/);
  const english = consentPage(details, "opaque-handle", request("&lang=en"), "en");
  assert.match(english, /<html lang='en'>/);
  assert.match(english, /Allow access/);
  assert.match(english, /Allow new-site creation only/);
  assert.match(english, /Connection code/);
  assert.match(english, /Cancel/);
});

test("show a trusted client icon only for a recognized domain", () => {
  const chatgpt = consentPage({
    ...details, clientName: "ChatGPT", clientDomain: "chatgpt.com", redirectHost: "chatgpt.com",
  }, "id", request(), "en");
  assert.ok(chatgpt.includes("src='/plugin-icons/chatgpt.svg'"));
  assert.match(chatgpt, /Verified domain: chatgpt.com/);
  assert.ok(!chatgpt.includes("src='https://chatgpt.com/favicon.ico'"));
  assert.ok(chatgpt.includes("client-icon-fallback' aria-hidden='true'>C<img"));

  const claude = consentPage({ ...details, clientName: "Claude", clientDomain: "claude.ai" }, "id", request(), "en");
  assert.ok(claude.includes("src='/plugin-icons/claude.svg'"));
  const cursor = consentPage({ ...details, clientName: "Cursor", clientDomain: "cursor.com" }, "id", request(), "en");
  assert.ok(cursor.includes("src='/plugin-icons/cursor.svg'"));

  const vscode = consentPage({ ...details, clientName: "Visual Studio Code", clientDomain: "vscode.dev" }, "id", request(), "en");
  assert.ok(vscode.includes("src='/plugin-icons/vscode.svg'"));
  assert.match(vscode, /Verified · vscode.dev/);
  const cursorCallback = consentPage({
    ...details, clientName: "Cursor", clientDomain: null, redirectHost: "www.cursor.com",
    redirectUri: "https://www.cursor.com/agents/mcp/oauth/callback",
  }, "id", request(), "ja");
  assert.ok(cursorCallback.includes("src='/plugin-icons/cursor.svg'"));
  assert.match(cursorCallback, /提供元未確認/);
  assert.doesNotMatch(cursorCallback, /移動先: www.cursor.com/);

  for (const modified of [
    { redirectUri: "https://www.cursor.com.evil.example/agents/mcp/oauth/callback" },
    { redirectUri: "https://www.cursor.com/agents/mcp/oauth/callback/extra" },
    { redirectUri: "http://www.cursor.com/agents/mcp/oauth/callback" },
    { clientName: "Impersonator" },
  ]) {
    const spoofed = consentPage({
      ...details, clientName: "Cursor", clientDomain: null, redirectHost: "www.cursor.com",
      redirectUri: "https://www.cursor.com/agents/mcp/oauth/callback", ...modified,
    }, "id", request(), "en");
    assert.doesNotMatch(spoofed, /src='\/plugin-icons\/cursor.svg'/);
  }

  const unknown = consentPage({ ...details, clientName: "ChatGPT", clientDomain: "example.net" }, "id", request(), "en");
  assert.doesNotMatch(unknown, /<img src=/);
  assert.match(unknown, /client-icon-fallback/);

  const spoofedRedirect = consentPage({
    ...details, clientName: "ChatGPT", clientDomain: null, redirectHost: "chatgpt.com",
  }, "id", request(), "en");
  assert.doesNotMatch(spoofedRedirect, /<img src=/);
});

test("new-site consent has an outlined blue button at the same size as regular consent", () => {
  assert.ok(consentStyles.includes(".approve, .draft { display: block; width: 100%; min-height: 44px;"));
  assert.ok(consentStyles.includes(".approve { background: var(--accent); color: #fff; }"));
  assert.ok(consentStyles.includes(".draft { background: #fff; color: var(--accent); }"));
  assert.ok(consentStyles.includes(".draft:hover { background: #edf4ff; }"));
});

test("expanded connection code and details scroll inside the desktop consent card", () => {
  assert.ok(consentStyles.includes("max-height: calc(100dvh - 32px); min-height: 0; overflow: visible;"));
  assert.match(consentStyles, /\.card:has\(\.code-option\[open\]\), \.card:has\(\.details\[open\]\)\s*\{\s*overflow-y: auto;/);
  assert.match(consentStyles, /\.card:has\(\.code-option\[open\]\), \.card:has\(\.details\[open\]\)\s*\{\s*overflow-y: auto;\s*overscroll-behavior: contain;/);
  assert.ok(consentStyles.includes("max-height: clamp(120px, calc(100dvh - 460px), 320px); overflow-y: auto;"),
    "site selection remains independently scrollable while both details panels are closed");
  assert.match(consentStyles, /@media \(max-width: 520px\)[\s\S]*\.card:has\(\.code-option\[open\]\), \.card:has\(\.details\[open\]\)\s*\{\s*overflow: visible;/,
    "mobile layouts must use ordinary page scrolling rather than nested modal scrolling");
  assert.doesNotMatch(consentStyles, /\.official-sites h2/);
  assert.doesNotMatch(consentStyles, /radial-gradient|\.option-heading|\.consent-heading/);
  assert.match(consentStyles, /max-height: clamp\(112px, calc\(100dvh - 450px\), 180px\)/);
});

test("language links preserve the OAuth parameters and never reflect unescaped client input", () => {
  const malicious = {
    ...details,
    clientName: "<img src=x onerror=alert(1)>",
    clientDomain: "' onclick='evil()",
    redirectHost: "<script>evil()</script>",
    scope: ["<script>evil()</script>"],
  };
  const html = consentPage(malicious, "'><script>evil()</script>", request("&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback"), "ja");
  assert.match(html, /client_id=client123/);
  assert.match(html, /state=abc/);
  assert.match(html, /lang=en/);
  assert.match(html, /lang=ja/);
  assert.match(html, /&#60;script&#62;/);
  assert.doesNotMatch(html, /<script>evil\(\)<\/script>/);
  assert.doesNotMatch(html, /onclick='evil\(\)/);
});

test("show unverified identities and a loopback warning in connection details", () => {
  const html = consentPage({ ...details, clientDomain: null, redirectIsLoopback: true }, "id", request(), "en");
  assert.match(html, /Identity unverified/);
  assert.match(html, /running on your device/);
});

test("authorization error pages and known pairing failures are localized", () => {
  assert.equal(consentErrorKey("Invalid pairing code"), "invalidCode");
  assert.equal(consentErrorKey("Too many pairing requests"), "tooMany");
  assert.equal(consentErrorKey("The browser is not connected, or this code was already used"), "expiredCode");
  assert.equal(consentErrorKey("unexpected stack trace"), "genericError");
  const html = consentErrorPage("ja", "invalidRequest");
  assert.match(html, /<html lang='ja'>/);
  assert.match(html, /認証リクエストが無効/);
  assert.match(html, /role='alert'/);
  assert.doesNotMatch(html, /<form/);
});
