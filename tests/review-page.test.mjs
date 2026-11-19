import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewPage, reviewFixture } from "../src/review-page.js";
import { sha256 } from "../src/pair-code.js";
import { checkStagedSiteDoc } from "../src/site-doc-check.js";
const origin = "https://mcp.tsumu.ebii.net";
// Ephemeral test-only input. Never a configured reviewer credential.
const password = crypto.randomUUID();
const salt = crypto.getRandomValues(new Uint8Array(16));
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const digest = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256));
function setup() {
  const calls = []; const docs = [];
  return { calls, docs, env: {
    REVIEW_USERNAME: "review-test", REVIEW_PASSWORD_HASH: "pbkdf2-sha256$100000$" + hex(salt) + "$" + hex(digest),
    PAIRINGS: { getByName: name => ({ fetch: async (_, init) => { calls.push({ name, ...JSON.parse(init.body) }); return new Response(null); } }) },
    IMPORT_DRAFTS: { getByName: () => ({ fetch: async (_, init) => { docs.push(JSON.parse(new TextDecoder().decode(init.body))); return new Response(null); } }) },
  } };
}
function post(user = "review-test", pass = password, extra = {}) {
  return new Request(origin + "/review", { method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded", ...extra }, body: new URLSearchParams({ username: user, password: pass }) });
}
test("review gate is disabled unless both valid settings exist", async () => {
  for (const env of [{}, { REVIEW_USERNAME: "x" }, { REVIEW_USERNAME: "x", REVIEW_PASSWORD_HASH: "invalid" }]) assert.equal((await reviewPage(new Request(origin + "/review"), env)).status, 404);
});
test("login page does not stage a fixture or expose configured values", async () => {
  const s = setup(); const r = await reviewPage(new Request(origin + "/review"), s.env); const html = await r.text();
  assert.equal(r.status, 200); assert.equal(s.calls.length, 0); assert.equal(s.docs.length, 0);
  assert.ok(!html.includes(password)); assert.ok(!html.includes(s.env.REVIEW_PASSWORD_HASH));
  assert.equal(r.headers.get("cache-control"), "no-store"); assert.equal(r.headers.get("referrer-policy"), "same-origin");
});
test("reject cross-origin and oversized posts before work", async () => {
  const s = setup(); assert.equal((await reviewPage(post(undefined, undefined, { Origin: "https://other.example" }), s.env)).status, 403);
  assert.equal((await reviewPage(post(undefined, "x".repeat(3000)), s.env)).status, 413); assert.equal(s.calls.length, 0);
});
test("wrong username and password have identical generic response, no draft", async () => {
  const s = setup(); const a = await reviewPage(post("wrong"), s.env); const b = await reviewPage(post(undefined, "wrong"), s.env);
  assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(await a.text(), await b.text()); assert.equal(s.docs.length, 0); assert.equal(s.calls.length, 4);
});
test("quota fails closed and never uses forwarded IP", async () => {
  const s = setup(); s.env.PAIRINGS.getByName = () => ({ fetch: async () => new Response(null, { status: 429 }) });
  assert.equal((await reviewPage(post(), s.env)).status, 429); assert.equal(s.docs.length, 0);
});
test("successful login prepares only fixed fresh fixture, fragment link, no cookie or OAuth grant", async () => {
  const s = setup(); const r = await reviewPage(post(), s.env); const html = await r.text();
  assert.equal(r.status, 200); assert.equal(r.headers.get("set-cookie"), null);
  assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  assert.ok(html.includes("https://tsumu.ebii.net/#tsumu-import=")); assert.ok(html.includes("noopener noreferrer"));
  assert.ok(!html.includes(password)); assert.ok(!html.includes("access_token"));
  assert.deepEqual(s.docs, [reviewFixture()]); checkStagedSiteDoc(s.docs[0]);
  assert.deepEqual(s.docs[0].pageOrder, ["page_home", "page_404"]);
  assert.deepEqual(s.calls.map(c => c.name), ["review-login", "review-login", "review-drafts"]);
});
test("revocation disables login and errors do not expose exception content", async () => {
  const s = setup(); delete s.env.REVIEW_PASSWORD_HASH; assert.equal((await reviewPage(post(), s.env)).status, 404);
  const t = setup(); t.env.IMPORT_DRAFTS.getByName = () => { throw new Error("private error detail"); };
  const r = await reviewPage(post(), t.env); assert.equal(r.status, 503); assert.ok(!(await r.text()).includes("private error detail"));
});

test("IP rejection does not spend global quota, and untrusted forwarded IP is ignored", async () => {
  const s = setup(); const keys = [];
  s.env.PAIRINGS.getByName = () => ({ fetch: async (_, init) => { keys.push(JSON.parse(init.body)); return new Response(null, { status: 429 }); } });
  const r = await reviewPage(post(undefined, undefined, { "X-Forwarded-For": "untrusted" }), s.env);
  assert.equal(r.status, 429); assert.deepEqual(keys, [{ requester: await sha256("review-ip:unknown"), limit: 3 }]);
  assert.equal(reviewFixture().nodes.node_heading.text.content, "Tsumu Review Home");
});

test("login retries keep same-origin policy for every invalid credential form", async () => {
  for (const [user, pass] of [["wrong", password], ["review-test", "wrong"], ["review-test", ""], ["review-test", "x".repeat(257)]]) {
    const s = setup(); const r = await reviewPage(post(user, pass), s.env);
    assert.equal(r.status, 401); assert.equal(r.headers.get("referrer-policy"), "same-origin");
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.ok((await r.text()).includes("<form method='post' action='/review'>"));
    assert.equal(s.docs.length, 0);
    assert.equal((await reviewPage(post(), s.env)).status, 200);
  }
});
test("missing, null, foreign Origin and cross-site posts remain rejected before work", async () => {
  for (const extra of [{ Origin: "null" }, { Origin: "https://other.example" }, { "Sec-Fetch-Site": "cross-site" }, null]) {
    const s = setup(); const request = post(undefined, undefined, extra || {});
    if (extra === null) request.headers.delete("Origin");
    const r = await reviewPage(request, s.env);
    assert.equal(r.status, 403); assert.equal(r.headers.get("referrer-policy"), "no-referrer");
    assert.equal(s.calls.length, 0); assert.equal(s.docs.length, 0);
  }
});
