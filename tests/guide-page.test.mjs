import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { consentLocale } from "../src/consent-locales.js";
import { guideMessages } from "../src/guide-locales.js";
import { guidePage, guideResponse, guideCsp } from "../src/guide-page.js";
import { MCP_URL, manualGuideMessages } from "../src/manual-guide-locales.js";
import { GUIDE_MODE, PLUGIN_CLIENTS, pluginCatalog, pluginCatalogResponse, pluginLinks, safePluginUrl } from "../src/guide-links.js";

const keysOf = value => Array.isArray(value)
  ? value.map(keysOf)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, keysOf(value[key])])) : typeof value;

test("Japanese and English guide text have the same shape", () => {
  assert.deepEqual(keysOf(guideMessages.ja), keysOf(guideMessages.en));
  assert.deepEqual(keysOf(manualGuideMessages.ja), keysOf(manualGuideMessages.en));
});

test("the guide mode is one of the two guides", () => {
  assert.ok(["manual", "plugins"].includes(GUIDE_MODE));
});

test("the guide language follows ?lang, then the browser's languages", () => {
  const request = (query, accept) => new Request("https://mcp.tsumu.ebii.net/" + query, { headers: { "Accept-Language": accept } });
  assert.equal(consentLocale(request("", "ja-JP,ja;q=0.9,en;q=0.8")), "ja");
  assert.equal(consentLocale(request("", "en-US,en;q=0.9")), "en");
  assert.equal(consentLocale(request("", "fr-FR")), "en");
  assert.equal(consentLocale(request("?lang=en", "ja-JP")), "en");
  assert.equal(consentLocale(request("?lang=ja", "en-US")), "ja");
});

test("both languages render every client, both flows and existing screenshots", () => {
  for (const locale of ["ja", "en"]) {
    const html = guidePage(locale, "plugins");
    assert.match(html, new RegExp("<html lang='" + locale + "'>"));
    assert.match(html, /id='new-site'/);
    assert.match(html, /id='edit-site'/);
    assert.match(html, /hreflang='ja'/);
    assert.match(html, /hreflang='en'/);
    for (const { id } of PLUGIN_CLIENTS) {
      assert.match(html, new RegExp("id='app-" + id + "'"));
      assert.match(html, new RegExp("src='/plugin-icons/" + id + "\\.svg'"));
      assert.ok(existsSync(new URL("../public/plugin-icons/" + id + ".svg", import.meta.url)), "missing icon " + id);
    }
    const images = [...html.matchAll(/src='(\/guide\/[^']+)'/g)].map(match => match[1]);
    assert.ok(images.length >= 6);
    for (const path of images) {
      assert.ok(existsSync(new URL("../public" + path, import.meta.url)), "missing screenshot " + path);
    }
    assert.doesNotMatch(html, /<script/, "the guide has no scripts");
    assert.doesNotMatch(html, /mcp\.tsumu\.ebii\.net\/mcp|mcpServers|serverUrl|httpUrl/, "no manual MCP setup on the public guide");
    assert.match(html, /href='https:\/\/github\.com\/abshrimp\/tsumu-mcp'><svg class='gh'/, "GitHub links carry the GitHub mark");
  }
  assert.match(guidePage("ja", "plugins"), /新しいサイトを AI に作ってもらう/);
  assert.match(guidePage("en", "plugins"), /Have the AI build a new site/);
});

test("the manual guide gives every client setup steps with the MCP URL", () => {
  for (const locale of ["ja", "en"]) {
    const html = guidePage(locale, "manual");
    assert.match(html, new RegExp("<html lang='" + locale + "'>"));
    assert.ok(html.includes(MCP_URL), "shows the MCP server URL");
    assert.match(html, /id='new-site'/);
    assert.match(html, /id='edit-site'/);
    for (const id of ["chatgpt", "claude", "cursor", "vscode", "claude-code", "codex", "gemini"]) {
      assert.match(html, new RegExp("<details class='setup-client' id='app-" + id + "'"));
      assert.ok(html.includes("id=\'app-" + id + "\'"), "steps for " + id);
    }
    assert.match(html, /id='app-vscode'/, "VS Code has a setup accordion");
    assert.match(html, /id='app-claude-code'/, "Claude Code has a setup accordion");
    assert.match(html, /id='app-codex'/, "Codex has a setup accordion");
    assert.match(html, /gemini mcp add --transport http --scope user/);
    assert.doesNotMatch(html, /data-plugin=/, "no plugin buttons in manual mode");
    for (const path of [...html.matchAll(/src='(\/guide\/[^']+)'/g)].map(match => match[1])) {
      assert.ok(existsSync(new URL("../public" + path, import.meta.url)), "missing screenshot " + path);
    }
    assert.doesNotMatch(html, /<script/, "the guide has no scripts");
  }
});

test("a client without a public plugin URL is marked as coming soon", () => {
  const html = guidePage("en", "plugins");
  for (const { id } of PLUGIN_CLIENTS) {
    if (safePluginUrl(pluginLinks[id])) continue;
    assert.match(html, new RegExp("id='app-" + id + "' data-plugin='pending'"));
  }
  if (PLUGIN_CLIENTS.some(({ id }) => !safePluginUrl(pluginLinks[id]))) assert.match(html, /Coming soon/);
});

test("plugin links accept only absolute https URLs", () => {
  assert.equal(safePluginUrl("https://example.com/plugin"), "https://example.com/plugin");
  assert.equal(safePluginUrl("javascript:alert(1)"), null);
  assert.equal(safePluginUrl("http://example.com"), null);
  assert.equal(safePluginUrl("/relative"), null);
  assert.equal(safePluginUrl(null), null);
});

test("the plugin catalog lists only published plugins, with absolute icons", async () => {
  const published = PLUGIN_CLIENTS.filter(({ id }) => safePluginUrl(pluginLinks[id])).map(({ id }) => id);
  const catalog = pluginCatalog("https://mcp.tsumu.ebii.net");
  assert.equal(catalog.guideUrl, "https://mcp.tsumu.ebii.net/");
  assert.deepEqual(catalog.plugins.map(plugin => plugin.id), published);
  for (const plugin of catalog.plugins) {
    assert.match(plugin.icon, /^https:\/\/mcp\.tsumu\.ebii\.net\/plugin-icons\/[a-z]+\.svg$/);
    assert.match(plugin.url, /^https:\/\//);
  }
  const response = pluginCatalogResponse(new Request("https://mcp.tsumu.ebii.net/plugins.json"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal((await response.json()).plugins.length, published.length);
  const head = pluginCatalogResponse(new Request("https://mcp.tsumu.ebii.net/plugins.json", { method: "HEAD" }));
  assert.equal(head.status, response.status);
  assert.deepEqual([...head.headers], [...response.headers]);
  assert.equal(head.body, null);
  const preflight = pluginCatalogResponse(new Request("https://mcp.tsumu.ebii.net/plugins.json", { method: "OPTIONS" }));
  assert.equal(preflight.status, 204);
});

test("the guide response is HTML with a strict CSP", async () => {
  const response = guideResponse("ja");
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("content-security-policy"), guideCsp);
  assert.doesNotMatch(guideCsp, /script-src/);
  assert.doesNotMatch(guideCsp, /unsafe-eval/);
  assert.equal(response.headers.get("vary"), "Accept-Language");
  assert.match(await response.text(), /AIアプリから、Tsumuのサイトを作る・編集する/);
  assert.match(await guideResponse("ja", "GET", "plugins").text(), /プラグインを入手|準備中/);
  assert.equal(await guideResponse("en", "HEAD").text(), "");
});
