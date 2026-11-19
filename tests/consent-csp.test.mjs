import assert from "node:assert/strict";
import { test } from "node:test";
import { consentCsp } from "../src/consent-csp.js";

test("permit a validated ChatGPT OAuth callback after POST /authorize", () => {
  const csp = consentCsp("https://chatgpt.com/connector_platform_oauth_redirect?code=secret&state=secret");
  assert.match(csp, /form-action 'self' https:\/\/chatgpt\.com https:\/\/platform\.openai\.com;/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /default-src 'none'/);
  assert.doesNotMatch(csp, /code=secret/);
});

test("do not permit the ChatGPT relay for unrelated callback paths or lookalike domains", () => {
  assert.match(consentCsp("https://chatgpt.com/other_callback"), /form-action 'self' https:\/\/chatgpt\.com;/);
  assert.doesNotMatch(consentCsp("https://chatgpt.com/other_callback"), /platform\.openai\.com/);
  assert.doesNotMatch(consentCsp("https://chatgpt.com.evil.example/connector_platform_oauth_redirect"), /platform\.openai\.com/);
});

test("permit other validated OAuth callback origins, including local MCP clients", () => {
  assert.match(consentCsp("https://claude.ai/oauth/callback"), /form-action 'self' https:\/\/claude\.ai;/);
  assert.match(consentCsp("http://127.0.0.1:8462/callback"), /form-action 'self' http:\/\/127\.0\.0\.1:8462;/);
});

test("do not allow an arbitrary injected CSP source or unsafe URL schemes", () => {
  assert.doesNotMatch(consentCsp("https://example.com/callback?next='*'"), /form-action 'self' .*\*/);
  assert.throws(() => consentCsp("javascript:alert(1)"), /Unsupported OAuth callback scheme/);
  assert.throws(() => consentCsp("data:text/html,text"), /Unsupported OAuth callback scheme/);
});
