import assert from "node:assert/strict";
import { test } from "node:test";
import { bridgeRequest } from "../src/bridge.js";

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
