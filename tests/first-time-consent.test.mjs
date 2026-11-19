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

test("first-time visitors see temporary site creation first, with pairing code behind disclosure", () => {
  const html = consentPage(details, "opaque-handle", request(), "ja");
  assert.match(html, /Tsumuの新規サイトの一時作成だけを許可します。/);
  assert.match(html, /<details class='code-option'><summary>接続コードがある場合はこちら<\/summary>/);
  assert.ok(html.indexOf("value='draft'") < html.indexOf("class='code-option'"));
  assert.match(html, /name='code'[^>]+required/);
  assert.match(html, /name='decision' value='draft'/);
  assert.match(html, /name='decision' value='deny'/);
});

test("an issued-code cookie shows the pairing form first without changing authorization choices", () => {
  const html = consentPage(details, "opaque-handle", request("other=1; tsumu_mcp_code_issued=1"), "ja");
  assert.match(html, /Tsumuの接続コードを入力して/);
  assert.doesNotMatch(html, /class='code-option'/);
  assert.ok(html.indexOf("name='code'") < html.indexOf("value='draft'"));
  assert.match(html, /name='decision' value='approve'/);
  assert.match(html, /name='decision' value='draft'/);
  assert.match(html, /name='decision' value='deny'/);
});

test("unrelated or invalid cookie values do not hide the first-time experience", () => {
  for (const cookie of ["tsumu_mcp_code_issued=0", "tsumu_mcp_code_issued=10", "other_tsumu_mcp_code_issued=1"]) {
    assert.match(consentPage(details, "handle", request(cookie), "en"), /Have a connection code\? Use it here/, cookie);
  }
});

test("the pairing code is submitted only by the paired-site approval form", () => {
  for (const cookie of ["", "tsumu_mcp_code_issued=1"]) {
    const html = consentPage(details, "opaque-handle", request(cookie), "ja");
    const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]);
    for (const decision of ["approve", "draft", "deny"]) {
      const form = forms.find(item => item.includes("name='decision' value='" + decision + "'"));
      assert.ok(form, decision);
      assert.match(form, /method='post' action='\/authorize'/);
      assert.match(form, /name='handle' value='opaque-handle'/);
      assert.match(form, /name='lang' value='ja'/);
      assert.equal(form.includes("name='code'"), decision === "approve");
      assert.equal(form.match(/type='submit'/g)?.length, 1, "Enter must select the form's own action");
    }
  }
});
