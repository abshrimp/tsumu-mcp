import assert from "node:assert/strict";
import { test } from "node:test";
import { bridgeRequest, redeemPairing } from "../src/bridge.js";
import { reconnectCookie } from "../src/bridge-cookie.js";

const origin = "https://editor.example";
const sessionId = "f293ab06-ab4b-446c-b8eb-70ac949eb6c6";
const credentials = { sessionId, connectToken: "token" };
const noStorage = { getByName: () => assert.fail("Invalid input reached storage") };
const noBindings = { PAIRINGS: noStorage, BROWSER_SESSIONS: noStorage };

function request(path, input, type = "application/json") {
  return new Request("https://mcp.example/bridge/" + path, {
    method: "POST", headers: { Origin: origin, "Content-Type": type }, body: JSON.stringify(input),
  });
}

test("bridge POST routes require the JSON media type", async () => {
  for (const path of ["sessions", "revoke"]) {
    for (const type of ["application/jsonp", "application/json-patch+json", "text/plain", ""]) {
      const response = await bridgeRequest(request(path, credentials, type), noBindings);
      assert.equal(response.status, 415, type);
    }
    const get = new Request("https://mcp.example/bridge/" + path, { headers: { Origin: origin } });
    assert.equal((await bridgeRequest(get, noBindings)).status, 405);
  }
});

test("bridge routes reject malformed JSON and invalid value shapes before accessing storage", async () => {
  for (const path of ["sessions", "revoke"]) {
    for (const value of [null, 1, "string", [], {}]) {
      assert.equal((await bridgeRequest(request(path, value), noBindings)).status, 400);
    }
    const invalid = new Request("https://mcp.example/bridge/" + path, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{",
    });
    assert.equal((await bridgeRequest(invalid, noBindings)).status, 400);
  }
  const arrayId = request("revoke", { ...credentials, sessionId: [sessionId] });
  assert.equal((await bridgeRequest(arrayId, noBindings)).status, 400);
});

test("revocation accepts a string session ID and JSON with case-insensitive type and parameters", async () => {
  const env = { BROWSER_SESSIONS: {
    getByName(id) {
      assert.equal(id, sessionId);
      return { fetch(url, options) {
        assert.equal(url, "https://internal/revoke");
        assert.deepEqual(JSON.parse(options.body), { connectToken: credentials.connectToken });
        return Response.json({ ok: true });
      } };
    },
  } };
  const response = await bridgeRequest(request("revoke", credentials, "Application/JSON; charset=UTF-8"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});


test("a failed browser claim restores its still-valid pairing code", async () => {
  const calls = [];
  const sessionId = "12345678-1234-4234-8234-123456789abc";
  const expiresAt = Date.now() + 5 * 60_000;
  const env = {
    PAIRINGS: {
      getByName: () => ({ fetch: async (url, init) => {
        const path = new URL(url).pathname;
        calls.push(path);
        const input = JSON.parse(init.body);
        assert.match(input.hash, /^[a-f0-9]{64}$/);
        if (path === "/take") return Response.json({ sessionId, expiresAt });
        if (path === "/restore") {
          assert.deepEqual(Object.keys(input).sort(), ["expiresAt", "hash", "sessionId"]);
          assert.equal(input.sessionId, sessionId);
          assert.equal(input.expiresAt, expiresAt);
          return Response.json({ restored: true });
        }
        assert.fail("Unexpected registry operation " + path);
      } }),
    },
    BROWSER_SESSIONS: {
      getByName: (id) => {
        assert.equal(id, sessionId);
        return { fetch: async () => {
          calls.push("/claim");
          return Response.json({ error: "Browser offline" }, { status: 410 });
        } };
      },
    },
  };
  await assert.rejects(redeemPairing(env, "ABCDEFGHJKLMNPQRSTUV", "127.0.0.1"),
    /browser is not connected/);
  assert.deepEqual(calls, ["/take", "/claim", "/restore"]);
});

test("an old editor tab cannot revoke the newer tab's cookie session", async () => {
  const newerSession = "12345678-1234-4234-8234-123456789abc";
  const cookie = (await reconnectCookie(origin, "demo", newerSession, "x".repeat(43))).split(";")[0];
  const calls = [];
  const env = { BROWSER_SESSIONS: { getByName(id) {
    calls.push(id);
    return { fetch: async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body), { connectToken: credentials.connectToken });
      return Response.json({ ok: true });
    } };
  } } };
  const request = new Request("https://mcp.example/bridge/revoke", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials, siteId: "demo" }),
  });
  const response = await bridgeRequest(request, env);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [sessionId], "the explicit session, not the newer cookie, is revoked");
  assert.equal(response.headers.get("Set-Cookie"), null,
    "a stale tab must not erase the replacement tab's reconnect cookie");
});

test("cookie-only disconnect revokes the matching site and clears its grant", async () => {
  const cookie = (await reconnectCookie(origin, "demo", sessionId, "x".repeat(43))).split(";")[0];
  let calls = 0;
  const env = { BROWSER_SESSIONS: { getByName(id) {
    assert.equal(id, sessionId);
    return { fetch: async (_url, init) => {
      const data = JSON.parse(init.body);
      assert.equal(data.origin, origin);
      assert.equal(data.siteId, "demo");
      assert.match(data.resumeHash, /^[a-f0-9]{64}$/);
      calls++;
      return Response.json({ ok: true });
    } };
  } } };
  const request = new Request("https://mcp.example/bridge/revoke", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ siteId: "demo" }),
  });
  const response = await bridgeRequest(request, env);
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});


test("a failed revocation does not erase the browser's only retry credential", async () => {
  const cookie = (await reconnectCookie(origin, "demo", sessionId, "x".repeat(43))).split(";")[0];
  const env = { BROWSER_SESSIONS: {
    getByName: id => {
      assert.equal(id, sessionId);
      return { fetch: async () => Response.json({ error: "Unavailable" }, { status: 503 }) };
    },
  } };
  const request = new Request("https://mcp.example/bridge/revoke", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ siteId: "demo" }),
  });
  const response = await bridgeRequest(request, env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Set-Cookie"), null,
    "transient errors must leave the HttpOnly cookie available for a retry");
});
