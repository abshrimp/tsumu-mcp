import assert from "node:assert/strict";
import { test } from "node:test";
import { consentPage } from "../src/consent-page.js";

const details = {
  clientName: "ChatGPT", clientDomain: "chatgpt.com", redirectHost: "chatgpt.com",
  redirectIsLoopback: false, scope: ["tsumu:access"],
};
const request = (cookie = "") => new Request("https://mcp.tsumu.ebii.net/authorize?client_id=example", {
  headers: cookie ? { Cookie: cookie } : {},
});

test("OAuth shows official-site selection first and keeps code and draft authorization available", () => {
  const html = consentPage(details, "opaque-handle", request(), "ja");
  assert.match(html, /接続方法を選択してください/);
  assert.match(html, /id='official-sites' class='official-sites' hidden/);
  assert.match(html, /id='official-site-directory'/);
  assert.match(html, /<details class='code-option'><summary>セルフホスト版の接続コードを入力<\/summary>/);
  assert.ok(html.indexOf("id='official-sites'") < html.indexOf("value='draft'"));
  assert.ok(html.indexOf("value='draft'") < html.indexOf("class='code-option'"),
    "self-hosted code comes after the draft-only choice");
  assert.match(html, /name='code'[^>]+required/);
  assert.match(html, /name='decision' value='draft'/);
  assert.match(html, /name='decision' value='deny'/);
  assert.match(html, /src='\/authorize-site\.js'/);
});

test("self-hosted code users retain a visible code form when the UI history cookie is present", () => {
  const html = consentPage(details, "opaque-handle", request("other=1; tsumu_mcp_code_issued=1"), "ja");
  assert.match(html, /接続方法を選択してください/);
  assert.match(html, /class='code-option' open/);
  assert.match(html, /name='code'[^>]+required/);
  assert.match(html, /name='decision' value='approve'/);
  assert.match(html, /name='decision' value='draft'/);
  assert.match(html, /name='decision' value='deny'/);
});

test("unrelated or invalid cookie values do not change the official site picker", () => {
  for (const cookie of ["tsumu_mcp_code_issued=0", "tsumu_mcp_code_issued=10", "other_tsumu_mcp_code_issued=1"]) {
    const html = consentPage(details, "handle", request(cookie), "en");
    assert.match(html, /id='official-sites'/, cookie);
    assert.match(html, /Connect a self-hosted Tsumu site/, cookie);
  }
});

test("all OAuth decisions remain bound to the same consent handle", () => {
  const html = consentPage(details, "opaque-handle", request(), "ja");
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]);
  assert.equal(forms.length, 4);
  for (const form of forms) {
    assert.match(form, /method='post' action='\/authorize'/);
    assert.match(form, /name='handle' value='opaque-handle'/);
    assert.match(form, /name='lang' value='ja'/);
  }
  const official = forms.find(item => item.includes("id='official-site-authorization'"));
  assert.ok(official);
  assert.match(official, /name='decision' value='approve'/);
  assert.match(official, /name='code'/);
  assert.doesNotMatch(official, /type='submit'/);
  const selfHosted = forms.find(item => item.includes("id='code'"));
  assert.ok(selfHosted);
  assert.match(selfHosted, /type='submit' name='decision' value='approve'/);
  for (const decision of ["draft", "deny"]) {
    const form = forms.find(item => item.includes("name='decision' value='" + decision + "'"));
    assert.ok(form);
    assert.equal(form.includes("name='code'"), false);
    assert.equal(form.match(/type='submit'/g)?.length, 1);
  }
});
