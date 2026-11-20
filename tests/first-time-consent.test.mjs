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

test("OAuth shows a compact multi-select site panel without the repeated site heading", () => {
  const html = consentPage(details, "opaque-handle", request(), "ja");
  assert.match(html, /接続するサイトを選択してください。/);
  assert.doesNotMatch(html, /<h2>サイトを選択<\/h2>/);
  assert.match(html, /id='official-sites' class='official-sites' hidden/);
  assert.match(html, /id='official-site-list'/);
  assert.match(html, /id='approve-selected-sites' type='button' disabled/);
  assert.match(html, /name='codes' value=''/);
  assert.match(html, /<details class='code-option'><summary>接続コードを入力<\/summary>/);
  assert.ok(html.indexOf("id='official-sites'") < html.indexOf("value='draft'"));
  assert.ok(html.indexOf("value='draft'") < html.indexOf("class='code-option'"),
    "the connection code always comes after the draft-only choice");
  assert.match(html, /name='decision' value='draft'/);
  assert.match(html, /name='decision' value='deny'/);
  assert.match(html, /src='\/authorize-site\.js'/);
});

test("the connection-code section always starts closed, regardless of connection-history cookies", () => {
  const baseline = consentPage(details, "opaque-handle", request(), "ja");
  for (const cookie of ["", "tsumu_mcp_code_issued=1", "tsumu_mcp_code_issued=0",
    "other=1; tsumu_mcp_code_issued=1"]) {
    const html = consentPage(details, "opaque-handle", request(cookie), "ja");
    assert.equal(html, baseline, "old history cookies must never change the UI");
    assert.match(html, /<details class='code-option'>/);
    assert.doesNotMatch(html, /class='code-option' open/);
  }
});

test("all OAuth decisions remain bound to the consent handle", () => {
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
  assert.match(official, /name='codes'/);
  assert.doesNotMatch(official, /name='code' value=/);
  assert.doesNotMatch(official, /type='submit'/);
  const manual = forms.find(item => item.includes("id='code'"));
  assert.ok(manual);
  assert.match(manual, /type='submit' name='decision' value='approve'/);
  for (const decision of ["draft", "deny"]) {
    const form = forms.find(item => item.includes("name='decision' value='" + decision + "'"));
    assert.ok(form);
    assert.equal(form.includes("name='code'"), false);
    assert.equal(form.match(/type='submit'/g)?.length, 1);
  }
});
