import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { guidePage, guideResponse, guideCsp } from "../src/guide-page.js";
import { pluginCatalog, pluginCatalogResponse, pluginLinks, PLUGIN_CLIENTS, safePluginUrl } from "../src/guide-links.js";

test("GET / serves the complete standalone user-supplied guide", () => {
  const html = guidePage();
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<script>/);
  assert.match(html, /data-lang="en"/);
  for (const name of ["chatgpt", "claude", "cursor", "vscode", "gemini"]) {
    assert.match(html, new RegExp("/landing/assets/" + name + "\\.svg"));
    assert.ok(existsSync(new URL("../public/landing/assets/" + name + ".svg", import.meta.url)));
  }
  for (let i = 1; i <= 12; i++) {
    const step = "step-" + String(i).padStart(2, "0") + ".png";
    assert.match(html, new RegExp("/landing/assets/" + step));
    assert.ok(existsSync(new URL("../public/landing/assets/" + step, import.meta.url)));
  }
  for (const i of [1, 2, 3, 4, 5, 6, 11, 12]) {
    const path = "en/step-" + String(i).padStart(2, "0") + ".png";
    assert.ok(existsSync(new URL("../public/landing/assets/" + path, import.meta.url)));
  }
  assert.match(html, /https:\/\/github\.com\/abshrimp\/tsumu-mcp\/blob\/main\/docs\/PRIVACY\.md/);
  assert.ok(html.includes('data-i18n="footerPrivacy">プライバシーポリシー</span>'));
  assert.match(html, /footerPrivacy: "Privacy Policy"/);
  assert.ok(html.includes('docs/PRIVACY.md"><svg class="gh"'), "privacy link includes GitHub icon");
  assert.match(html, /https:\/\/mcp\.tsumu\.ebii\.net\/mcp/);
  assert.doesNotMatch(html, /class='setup-client'/, "old composed guide is not included");
});

test("landing response keeps original inline script under hash-based CSP", async () => {
  const response = guideResponse(undefined, "GET");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("content-security-policy"), guideCsp);
  assert.match(guideCsp, /script-src 'sha256-/);
  const script = guidePage().match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "standalone guide must contain a script");
  const hash = createHash("sha256").update(script).digest("base64");
  assert.ok(guideCsp.includes("'sha256-" + hash + "'"), "CSP must match the exact inline guide script");
  assert.doesNotMatch(guideCsp, /unsafe-eval/);
  assert.doesNotMatch(guideCsp, /script-src[^;]*'unsafe-inline'/);
  assert.equal(await response.text(), guidePage());
  const head = guideResponse(undefined, "HEAD");
  assert.equal(head.body, null);
  assert.equal(await head.text(), "");
});

test("plugin links accept only absolute HTTPS addresses", () => {
  assert.equal(safePluginUrl("https://example.com/plugin"), "https://example.com/plugin");
  assert.equal(safePluginUrl("javascript:alert(1)"), null);
  assert.equal(safePluginUrl("http://example.com"), null);
  assert.equal(safePluginUrl("/relative"), null);
  assert.equal(safePluginUrl(null), null);
});

test("public plugin catalog includes only published plugins", async () => {
  const published = PLUGIN_CLIENTS.filter(({id}) => safePluginUrl(pluginLinks[id])).map(({id}) => id);
  const catalog = pluginCatalog("https://mcp.tsumu.ebii.net");
  assert.equal(catalog.guideUrl, "https://mcp.tsumu.ebii.net/");
  assert.deepEqual(catalog.plugins.map(plugin => plugin.id), published);
  const response = pluginCatalogResponse(new Request("https://mcp.tsumu.ebii.net/plugins.json"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal((await response.json()).plugins.length, published.length);
  const head = pluginCatalogResponse(new Request("https://mcp.tsumu.ebii.net/plugins.json", {method:"HEAD"}));
  assert.equal(head.body, null);
  const preflight = pluginCatalogResponse(new Request("https://mcp.tsumu.ebii.net/plugins.json", {method:"OPTIONS"}));
  assert.equal(preflight.status, 204);
});
