import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryStorage } from "./helpers/durable-object.mjs";

const { PairingRegistry } = await import("../src/pairings.js");
const requester = "a".repeat(64);
const hash = "b".repeat(64);
const take = () => new Request("https://internal/take", {
  method: "POST", body: JSON.stringify({ requester, hash }),
});

test("failed pairing attempts schedule cleanup even when no pairing code exists", async t => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const storage = memoryStorage();
  const registry = new PairingRegistry({ storage }, {});

  assert.equal((await registry.fetch(take())).status, 400);
  assert.equal(storage.records.get("rate:" + requester).count, 1);
  assert.ok(await storage.getAlarm() > now, "failed attempts must have an expiration alarm");

  now = await storage.getAlarm();
  await storage.setAlarm(null);
  await registry.alarm();
  assert.equal(storage.records.size, 0);
  assert.equal(await storage.getAlarm(), null);

  assert.equal((await registry.fetch(take())).status, 400);
  assert.ok(await storage.getAlarm() > now, "cleanup must restart after an idle period");
});

test("pairing attempt cleanup preserves the attempt limit until expiration", async t => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const storage = memoryStorage();
  const registry = new PairingRegistry({ storage }, {});

  for (let attempt = 0; attempt < 20; attempt++) {
    assert.equal((await registry.fetch(take())).status, 400);
  }
  assert.equal((await registry.fetch(take())).status, 429);
  now += 5 * 60_000;
  assert.equal((await registry.fetch(take())).status, 400);
  assert.equal(storage.records.get("rate:" + requester).count, 1);
});


test("failed browser claim can restore a one-time code without extending its expiry", async t => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const storage = memoryStorage();
  const registry = new PairingRegistry({ storage }, {});
  const sessionId = "12345678-1234-4234-8234-123456789abc";
  const post = (path, data) => registry.fetch(new Request("https://internal/" + path, {
    method: "POST", body: JSON.stringify(data),
  }));
  assert.equal((await post("put", { hash, sessionId })).status, 200);
  const originalExpiry = storage.records.get("code:" + hash).expiresAt;

  const first = await post("take", { hash, requester });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { sessionId, expiresAt: originalExpiry });
  assert.equal(storage.records.has("code:" + hash), false);

  now += 20_000;
  assert.equal((await post("restore", { hash, sessionId, expiresAt: originalExpiry })).status, 200);
  assert.equal(storage.records.get("code:" + hash).expiresAt, originalExpiry);
  assert.equal((await post("restore", { hash, sessionId, expiresAt: originalExpiry })).status, 409);
  assert.equal((await post("take", { hash, requester })).status, 200);

  now = originalExpiry;
  assert.equal((await post("restore", { hash, sessionId, expiresAt: originalExpiry })).status, 400);
  assert.equal(storage.records.has("code:" + hash), false);
});
