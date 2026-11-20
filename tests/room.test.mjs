import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryStorage } from "./helpers/durable-object.mjs";
import { writeFingerprint } from "../src/write-fingerprint.js";
import { sha256 } from "../src/pair-code.js";

const { BrowserSession } = await import("../src/room.js");
const action = "create_page";
const args = { requestId: "write-001", name: "About" };

async function sessionFixture() {
  const storage = memoryStorage();
  const sockets = [];
  await storage.put("session", {
    siteId: "demo", siteName: "Demo", canEdit: true, claimed: true, revoked: false,
    connectionId: "connection-1", secretHash: await sha256("connect-token"),
    expiresAt: Date.now() + 60_000, persistentUntil: Date.now() + 7 * 24 * 60 * 60_000,
  });
  const room = new BrowserSession({ storage, getWebSockets: () => sockets }, {});
  return { storage, sockets, room };
}

test("completed writes can be replayed while the browser is disconnected", async () => {
  const { storage, room } = await sessionFixture();
  const value = { result: { pageId: "about" } };
  await storage.put("result:" + args.requestId, {
    pending: false, fingerprint: await writeFingerprint(action, args), status: 200,
    value, expiresAt: Date.now() + 60_000,
  });
  const replay = await room.call({ action, args });
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), value);

  const conflict = await room.call({ action, args: { ...args, name: "Different" } });
  assert.equal(conflict.status, 409, "disconnection must not bypass requestId collision checks");
});

test("disconnected writes create no pending receipt and revoked sessions cannot replay results", async () => {
  const { storage, room } = await sessionFixture();
  assert.equal((await room.call({ action, args })).status, 503);
  assert.equal(storage.records.has("result:" + args.requestId), false);
  await storage.put("result:" + args.requestId, {
    pending: false, fingerprint: await writeFingerprint(action, args), status: 200,
    value: { result: { pageId: "about" } }, expiresAt: Date.now() + 60_000,
  });
  const session = await storage.get("session");
  await storage.put("session", { ...session, revoked: true });
  assert.equal((await room.call({ action, args })).status, 410);
});

test("revocation completes pending calls before the WebSocket close event", async t => {
  const { sockets, room } = await sessionFixture();
  const sent = Promise.withResolvers();
  const socket = {
    deserializeAttachment: () => ({ connectionId: "connection-1" }),
    send: () => sent.resolve(),
    close: () => {},
  };
  sockets.push(socket);
  t.after(() => room.failSocket(socket));
  const inFlight = room.call({ action, args });
  await sent.promise;
  assert.equal(room.pending.size, 1);

  const revoked = await room.fetch(new Request("https://internal/revoke", {
    method: "POST", body: JSON.stringify({ connectToken: "connect-token" }),
  }));
  assert.equal(revoked.status, 200);
  assert.equal(room.pending.size, 0, "revocation must release pending browser calls immediately");
  assert.equal((await inFlight).status, 503);
});

test("malformed WebSocket response values are ignored", async () => {
  const { room } = await sessionFixture();
  const socket = { deserializeAttachment: () => ({ connectionId: "connection-1" }) };
  for (const value of ["null", "false", "3", '"response"', "[]", "{}", "not-json"]) {
    await assert.doesNotReject(room.webSocketMessage(socket, value), value);
  }
});


test("OAuth pairing requires the current live editor socket", async () => {
  const { storage, sockets, room } = await sessionFixture();
  const session = await storage.get("session");
  await storage.put("session", { ...session, claimed: false });
  const claim = () => room.fetch(new Request("https://internal/claim", {
    method: "POST", body: "{}",
  }));

  // A replaced socket can still be present during its closing handshake.
  sockets.push({
    readyState: WebSocket.OPEN,
    deserializeAttachment: () => ({ connectionId: "replaced-connection" }),
  });
  assert.equal((await claim()).status, 410);
  assert.equal((await storage.get("session")).claimed, false);

  sockets.push({
    readyState: WebSocket.CLOSING,
    deserializeAttachment: () => ({ connectionId: "connection-1" }),
  });
  assert.equal((await claim()).status, 410, "a closing socket must not authorize a code");

  sockets.push({
    readyState: WebSocket.OPEN,
    deserializeAttachment: () => ({ connectionId: "connection-1" }),
  });
  assert.equal((await claim()).status, 200);
  assert.equal((await storage.get("session")).claimed, true);
  assert.equal((await claim()).status, 410, "pairing remains single-use");
});

test("large, schema-valid edits reach the browser bridge instead of failing at 128 KiB", async () => {
  const { room } = await sessionFixture();
  const response = await room.fetch(new Request("https://internal/call", {
    method: "POST",
    body: JSON.stringify({
      action: "apply_operations",
      args: {
        requestId: "large-edit-00001",
        pageId: "home",
        expectedRevision: "0".repeat(64),
        operations: [{ op: "set_text", id: "heading", text: "x".repeat(180000) }],
      },
    }),
  }));
  // No browser is attached to this fixture, but the request is accepted.
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /disconnected/i);
});
