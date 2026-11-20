import assert from "node:assert/strict";
import { test } from "node:test";
import { bridgeRequest } from "../src/bridge.js";
import { registerHooks } from "node:module";
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { url: "data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { BrowserSession } = await import("../src/room.js");
hook.deregister();
import { memoryStorage } from "./helpers/durable-object.mjs";
import { sha256 } from "../src/pair-code.js";
import { reconnectCookie, readReconnectCookie, clearReconnectCookie } from "../src/bridge-cookie.js";

const origin = "https://tsumu.ebii.net";
const endpoint = "https://mcp.tsumu.ebii.net";
const post = (path, data, headers = {}) =>
  new Request(endpoint + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data) });

function fixture() {
  const rooms = new Map();
  const env = {
    PAIRINGS: { getByName: () => ({ fetch: async () => Response.json({ ok: true }) }) },
    BROWSER_SESSIONS: { getByName: id => {
      if (!rooms.has(id)) {
        const storage = memoryStorage();
        const sockets = [];
        const room = new BrowserSession({ storage, getWebSockets: () => sockets }, {});
        rooms.set(id, { room, storage, sockets });
      }
      return { fetch: (request, init) => rooms.get(id).room.fetch(typeof request === "string" ? new Request(request, init) : request) };
    } },
  };
  return { env, rooms };
}

test("new pairings issue a site-scoped Secure HttpOnly reconnect cookie", async () => {
  const { env, rooms } = fixture();
  const response = await bridgeRequest(post("/bridge/sessions",
    { siteId: "site-one", siteName: "Site One", canEdit: false }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), "true");
  const grant = response.headers.get("Set-Cookie");
  assert.match(grant, /^__Host-tsumu_mcp_/);
  assert.match(grant, /HttpOnly/);
  assert.match(grant, /Secure/);
  assert.match(grant, /SameSite=None/);
  assert.match(grant, /Max-Age=604800/);
  assert.doesNotMatch(grant, /connectToken/);
  const result = await response.json();
  assert.equal(result.pairingCode.length, 23);
  const stored = await rooms.get(result.sessionId).storage.get("session");
  assert.equal(stored.origin, origin);
  assert.equal(stored.canEdit, false);
  assert.equal(stored.claimed, false);
  const preflight = await bridgeRequest(new Request(endpoint + "/bridge/restore", {
    method: "OPTIONS", headers: { Origin: origin } }), env);
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
});

test("restore and renew rotate the cookie; origin/site mismatches cannot read another grant", async () => {
  const { env, rooms } = fixture();
  const created = await bridgeRequest(post("/bridge/sessions",
    { siteId: "site-one", siteName: "Site One", canEdit: true }), env);
  const initialCookie = created.headers.get("Set-Cookie").split(";")[0];
  const issued = await created.json();
  const record = rooms.get(issued.sessionId);
  const session = await record.storage.get("session");
  session.claimed = true;
  await record.storage.put("session", session);

  const wrongSite = await bridgeRequest(post("/bridge/restore", { siteId: "site-two" }, { Cookie: initialCookie }), env);
  assert.equal(wrongSite.status, 404);
  const wrongOrigin = await bridgeRequest(post("/bridge/restore", { siteId: "site-one" },
    { Cookie: initialCookie, Origin: "https://attacker.example" }), env);
  assert.equal(wrongOrigin.status, 404);

  const restored = await bridgeRequest(post("/bridge/restore", { siteId: "site-one" },
    { Cookie: initialCookie }), env);
  assert.equal(restored.status, 200);
  const restoration = await restored.json();
  assert.equal(restoration.siteId, "site-one");
  assert.equal(restoration.canEdit, true);
  assert.equal(restoration.pairingCode, null);
  assert.equal(restoration.sessionId, issued.sessionId);
  assert.notEqual(restoration.connectToken, issued.connectToken);
  assert.ok(restoration.expiresAt > Date.now() + 50 * 60_000);
  const nextCookie = restored.headers.get("Set-Cookie").split(";")[0];
  assert.notEqual(nextCookie, initialCookie, "the long-term credential must rotate");

  const updated = await record.storage.get("session");
  updated.expiresAt = Date.now() + 15_000;
  await record.storage.put("session", updated);
  const renewed = await bridgeRequest(post("/bridge/renew", { siteId: "site-one" },
    { Cookie: nextCookie }), env);
  assert.equal(renewed.status, 200);
  assert.ok((await renewed.json()).expiresAt > Date.now() + 50 * 60_000);
  assert.notEqual(renewed.headers.get("Set-Cookie").split(";")[0], nextCookie);
  assert.equal((await record.storage.get("session")).persistentUntil > Date.now() + 6 * 24 * 60 * 60_000, true);

  const revoked = await bridgeRequest(post("/bridge/revoke", { siteId: "site-one" },
    { Cookie: renewed.headers.get("Set-Cookie").split(";")[0] }), env);
  assert.equal(revoked.status, 200);
  assert.match(revoked.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal((await record.storage.get("session")).revoked, true);
  const denied = await bridgeRequest(post("/bridge/restore", { siteId: "site-one" },
    { Cookie: nextCookie }), env);
  assert.equal(denied.status, 403);
});

test("only an OAuth-claimed grant may be resumed and idle permissions expire after seven days", async () => {
  const { env, rooms } = fixture();
  const created = await bridgeRequest(post("/bridge/sessions",
    { siteId: "site-one", siteName: "Site One", canEdit: false }), env);
  const cookie = created.headers.get("Set-Cookie").split(";")[0];
  const issued = await created.json();
  const record = rooms.get(issued.sessionId);
  assert.equal((await bridgeRequest(post("/bridge/restore", { siteId: "site-one" },
    { Cookie: cookie }), env)).status, 403);
  const session = await record.storage.get("session");
  session.claimed = true;
  session.persistentUntil = Date.now() - 1;
  await record.storage.put("session", session);
  assert.equal((await bridgeRequest(post("/bridge/restore", { siteId: "site-one" },
    { Cookie: cookie }), env)).status, 403);
});

test("reconnect cookies are scoped to their origin and site", async () => {
  const sessionId = "12345678-1234-4234-8234-123456789abc";
  const secret = "s".repeat(43);
  const setCookie = await reconnectCookie(origin, "site-one", sessionId, secret);
  const req = post("/bridge/restore", { siteId: "site-one" }, { Cookie: setCookie.split(";")[0] });
  assert.deepEqual(await readReconnectCookie(req, origin, "site-one"), { sessionId, secret });
  assert.equal(await readReconnectCookie(req, origin, "site-two"), null);
  assert.equal(await readReconnectCookie(req, "https://attacker.example", "site-one"), null);
  assert.match(await clearReconnectCookie(origin, "site-one"), /Max-Age=0/);
});
