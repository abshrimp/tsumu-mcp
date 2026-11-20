import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// The consent helpers use standard Web APIs; only their Worker entrypoint needs
// a runtime class to load in Node. Keep the provider's validation and KV intact.
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { url: "data:text/javascript,export class WorkerEntrypoint {}", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { getOAuthApi } = await import("@cloudflare/workers-oauth-provider");
const { authorize } = await import("../src/oauth.js");
hook.deregister();

const base = "https://mcp.tsumu.ebii.net";
const callback = "https://client.example/callback";
const code = "ABCDE-FGHJK-LMNPQ-RSTUV";
const sessionId = "12345678-1234-4234-8234-123456789abc";

async function consentFixture() {
  const storage = new Map();
  const calls = [];
  const env = {
    OAUTH_KV: {
      async get(key, options) {
        const stored = storage.get(key);
        return stored === undefined ? null : options?.type === "json" ? JSON.parse(stored) : stored;
      },
      async put(key, value) { storage.set(key, value); },
      async delete(key) { storage.delete(key); },
      async list({ prefix }) {
        return { keys: [...storage.keys()].filter(name => name.startsWith(prefix)).map(name => ({ name })), list_complete: true };
      },
    },
    PAIRINGS: { getByName: () => ({ fetch: async url => {
      calls.push(new URL(url).pathname);
      return Response.json({ sessionId });
    } }) },
    BROWSER_SESSIONS: { getByName: () => ({ fetch: async url => {
      calls.push(new URL(url).pathname);
      return Response.json({ siteId: "test", siteName: "Test", canEdit: true });
    } }) },
  };
  const oauth = getOAuthApi({
    apiRoute: "/mcp", apiHandler: { fetch() {} }, defaultHandler: { fetch() {} },
    authorizeEndpoint: "/authorize", tokenEndpoint: "/oauth/token",
    scopesSupported: ["tsumu:access"],
    resourceMetadata: { resource: base + "/mcp", authorization_servers: [base] },
  }, env);
  env.OAUTH_PROVIDER = oauth;
  const client = await oauth.createClient({ redirectUris: [callback], tokenEndpointAuthMethod: "none" });
  const query = new URLSearchParams({
    client_id: client.clientId, redirect_uri: callback, response_type: "code",
    scope: "tsumu:access", state: "client-state", code_challenge: "a".repeat(43), code_challenge_method: "S256",
  });
  const authRequest = await oauth.parseAuthRequest(new Request(base + "/authorize?" + query));
  const consent = await oauth.beginConsent(authRequest);
  const cookie = consent.headers.get("Set-Cookie").split(";")[0];
  const request = (decision = "draft", cookieValue = cookie, fields = {}) => {
    const values = new URLSearchParams({ handle: consent.handle, lang: "en", decision, code, ...fields });
    if (Object.hasOwn(fields, "codes") && !Object.hasOwn(fields, "code")) values.delete("code");
    return new Request(base + "/authorize", {
      method: "POST", headers: { Cookie: cookieValue }, body: values,
    });
  };
  return { env, calls, request, storage };
}

test("unbound consent cannot consume a pairing code or draft quota", async () => {
  for (const decision of ["approve", "draft"]) {
    for (const cookie of ["", "__Host-oauth-consent-wrong=wrong"]) {
      const fixture = await consentFixture();
      const response = await authorize(fixture.request(decision, cookie), fixture.env);
      assert.equal(response.status, 400);
      assert.match(await response.text(), /authorization request is invalid or has expired/);
      assert.deepEqual(fixture.calls, [], decision);
    }
  }
});

test("expired consent cannot consume a pairing code or draft quota", async () => {
  for (const decision of ["approve", "draft"]) {
    const fixture = await consentFixture();
    for (const key of fixture.storage.keys()) if (key.startsWith("transaction:")) fixture.storage.delete(key);
    const response = await authorize(fixture.request(decision), fixture.env);
    assert.equal(response.status, 400);
    assert.deepEqual(fixture.calls, [], decision);
  }
});

test("validated consent issues one authorization and does not repeat side effects on replay", async () => {
  for (const decision of ["approve", "draft"]) {
    const fixture = await consentFixture();
    const response = await authorize(fixture.request(decision), fixture.env);
    assert.equal(response.status, 302, await response.text());
    const redirect = new URL(response.headers.get("Location"));
    assert.equal(redirect.origin + redirect.pathname, callback);
    assert.equal(redirect.searchParams.get("state"), "client-state");
    assert.ok(redirect.searchParams.get("code"));
    assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
    const expected = decision === "approve" ? ["/take", "/claim", "/grant/create"] : ["/quota"];
    assert.deepEqual(fixture.calls, expected);
    const replay = await authorize(fixture.request(decision), fixture.env);
    assert.equal(replay.status, 400);
    assert.deepEqual(fixture.calls, expected, "replayed consent must not mutate pairing state");
  }
});

test("invalid code syntax can be corrected before consuming consent", async () => {
  const fixture = await consentFixture();
  const invalid = await authorize(fixture.request("approve", undefined, { code: "invalid" }), fixture.env);
  assert.equal(invalid.status, 400);
  assert.deepEqual(fixture.calls, []);
  const valid = await authorize(fixture.request("approve"), fixture.env);
  assert.equal(valid.status, 302, await valid.text());
});

test("one OAuth approval grants exactly the two selected official sites", async () => {
  const fixture = await consentFixture();
  const anotherCode = "BCDEF-GHJKL-MNPQR-STUVW";
  const secondSession = "abcdef12-abcd-4abc-8abc-abcdef123456";
  let claims = 0;
  let authorizedSites = null;
  fixture.env.PAIRINGS = { getByName: () => ({ fetch: async (url, options) => {
    const path = new URL(url).pathname;
    fixture.calls.push(path);
    if (path === "/take-many") {
      const { hashes } = JSON.parse(options.body);
      assert.equal(hashes.length, 2);
      return Response.json({ entries: hashes.map((hash, index) => ({
        hash, sessionId: index === 0 ? sessionId : secondSession,
        expiresAt: Date.now() + 5 * 60_000,
      })) });
    }
    if (path === "/grant/create") {
      authorizedSites = JSON.parse(options.body).sites;
      return Response.json({ created: true });
    }
    throw new Error("Unexpected pairing operation " + path);
  } }) };
  fixture.env.BROWSER_SESSIONS = { getByName: id => ({ fetch: async (url, options) => {
    const path = new URL(url).pathname;
    fixture.calls.push(path);
    if (path === "/confirm-claim") return Response.json({ confirmed: true });
    assert.equal(path, "/claim");
    assert.match(JSON.parse(options.body).claimId, /^[0-9a-f-]{36}$/);
    claims++;
    return Response.json({ siteId: id === sessionId ? "site-a" : "site-b",
      siteName: id === sessionId ? "Alpha" : "Beta", canEdit: id === sessionId });
  } }) };
  const response = await authorize(fixture.request("approve", undefined, {
    codes: JSON.stringify([code, anotherCode]),
  }), fixture.env);
  assert.equal(response.status, 302, await response.text());
  assert.deepEqual(fixture.calls, ["/take-many", "/claim", "/claim", "/grant/create", "/confirm-claim", "/confirm-claim"]);
  assert.equal(claims, 2);
  assert.deepEqual(authorizedSites, [
    { siteId: "site-a", siteName: "Alpha", canEdit: true, sessionId },
    { siteId: "site-b", siteName: "Beta", canEdit: false, sessionId: secondSession },
  ]);
  assert.equal((await authorize(fixture.request("approve", undefined, {
    codes: JSON.stringify([code, anotherCode]),
  }), fixture.env)).status, 400, "the one-time OAuth consent cannot be reused");
});

test("invalid multi-site code arrays fail before OAuth consent or pairing", async () => {
  const cases = [
    "not-json", "[]", JSON.stringify(["bad"]), JSON.stringify([code, code]),
    JSON.stringify([code, 12]), JSON.stringify(Array(13).fill(code)),
    JSON.stringify({ codes: [code] }),
  ];
  for (const codes of cases) {
    const fixture = await consentFixture();
    const response = await authorize(fixture.request("approve", undefined, { codes }), fixture.env);
    assert.equal(response.status, 400, codes);
    assert.deepEqual(fixture.calls, [], "malformed input must not consume pairing codes");
    const recovered = await authorize(fixture.request("approve"), fixture.env);
    assert.equal(recovered.status, 302, await recovered.text());
  }
  const fixture = await consentFixture();
  const mixed = await authorize(fixture.request("approve", undefined, {
    code, codes: JSON.stringify([code]),
  }), fixture.env);
  assert.equal(mixed.status, 400, "manual and multi-site forms cannot be mixed");
  assert.deepEqual(fixture.calls, []);
});

test("quota rejection clears the consumed consent cookie", async () => {
  const fixture = await consentFixture();
  fixture.env.PAIRINGS = { getByName: () => ({ fetch: async () => new Response(null, { status: 429 }) }) };
  const response = await authorize(fixture.request(), fixture.env);
  assert.equal(response.status, 429);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("pairing failure clears the consumed consent cookie", async () => {
  const fixture = await consentFixture();
  fixture.env.PAIRINGS = { getByName: () => ({ fetch: async () => Response.json({ error: "Invalid or expired pairing code" }, { status: 400 }) }) };
  const response = await authorize(fixture.request("approve"), fixture.env);
  assert.equal(response.status, 400);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("OAuth pairing rate limits use HTTP 429 rather than a generic code error", async () => {
  const fixture = await consentFixture();
  fixture.env.PAIRINGS = { getByName: () => ({ fetch: async () => Response.json({ error: "Too many attempts" }, { status: 429 }) }) };
  const response = await authorize(fixture.request("approve"), fixture.env);
  assert.equal(response.status, 429);
  assert.match(await response.text(), /Too many connection attempts/);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("OAuth distinguishes broken pairing storage from incorrect user codes", async () => {
  const fixture = await consentFixture();
  fixture.env.PAIRINGS = { getByName: () => ({ fetch: async () => { throw new Error("Registry unavailable"); } }) };
  const response = await authorize(fixture.request("approve"), fixture.env);
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Unable to complete authorization/);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("draft-only OAuth does not report an unavailable quota backend as a rate limit", async () => {
  const fixture = await consentFixture();
  fixture.env.PAIRINGS = { getByName: () => ({ fetch: async () => Response.json({ error: "Service unavailable" }, { status: 503 }) }) };
  const response = await authorize(fixture.request("draft"), fixture.env);
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Unable to complete authorization/);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});

test("oversized consent forms are rejected before OAuth or pairing access", async () => {
  for (const declaredLength of [undefined, "5000"]) {
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    if (declaredLength) headers["Content-Length"] = declaredLength;
    const request = new Request(base + "/authorize", {
      method: "POST", headers, body: "decision=draft&handle=" + "x".repeat(5000),
    });
    const response = await authorize(request, {});
    assert.equal(response.status, 413);
  }
});

test("consent forms require the page's URL-encoded media type", async () => {
  const request = new Request(base + "/authorize", {
    method: "POST", headers: { "Content-Type": "text/plain" }, body: "decision=draft&handle=untrusted",
  });
  const response = await authorize(request, {});
  assert.equal(response.status, 415);
});

test("OpenAI app domain proof is exact and limited to GET and HEAD on the MCP origin", async () => {
  const proofHook = registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === "cloudflare:workers"
        ? { url: "data:text/javascript,export class WorkerEntrypoint {}; export class DurableObject {}", shortCircuit: true }
        : nextResolve(specifier, context);
    },
  });
  let worker;
  try { ({ default: worker } = await import("../src/index.js")); }
  finally { proofHook.deregister(); }
  const path = "/.well-known/openai-apps-challenge";
  const get = await worker.fetch(new Request(base + path), {}, {});
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("Content-Type"), "text/plain");
  assert.equal(await get.text(), "IU-4_L-YbSiOtFhVeLwWXsEZ78mE4kI6wJhPe3xTgyI");
  const head = await worker.fetch(new Request(base + path, { method: "HEAD" }), {}, {});
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Type"), "text/plain");
  assert.equal(head.body, null);
  for (const [url, method] of [[base + path, "POST"], [base + path + "/", "GET"], ["https://example.org" + path, "GET"]]) {
    const response = await worker.fetch(new Request(url, { method }), {}, {});
    assert.equal(response.status, 404);
  }
});
