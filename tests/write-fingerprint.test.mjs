import assert from "node:assert/strict";
import { test } from "node:test";
import { cachedWriteResult, writeFingerprint } from "../src/write-fingerprint.js";

test("write fingerprints are stable across input object key orders", async () => {
  const one = await writeFingerprint("apply_operations", {
    requestId: "write-001", pageId: "home", operations: [{ op: "set_text", id: "a", text: "A" }],
  });
  const reordered = await writeFingerprint("apply_operations", {
    operations: [{ text: "A", id: "a", op: "set_text" }], pageId: "home", requestId: "write-001",
  });
  assert.equal(one, reordered);
  assert.match(one, /^[a-f0-9]{64}$/);
});

test("reusing a requestId with different mutation content never replays the old result", async () => {
  const first = await writeFingerprint("apply_operations", { requestId: "write-001", text: "A" });
  const changed = await writeFingerprint("apply_operations", { requestId: "write-001", text: "B" });
  const newAction = await writeFingerprint("create_site", { requestId: "write-001", text: "A" });
  assert.notEqual(first, changed);
  assert.notEqual(first, newAction);
  const prior = { fingerprint: first, status: 200, value: { result: { applied: true } }, expiresAt: Date.now() + 60000 };
  assert.deepEqual(cachedWriteResult(prior, first), { status: 200, value: prior.value });
  assert.deepEqual(cachedWriteResult(prior, changed), {
    status: 409, value: { error: "requestId was already used for a different operation" },
  });
  assert.deepEqual(cachedWriteResult(prior, newAction), {
    status: 409, value: { error: "requestId was already used for a different operation" },
  });
});

test("in-flight or timed-out writes cannot be rerun with the same requestId", async () => {
  const fingerprint = await writeFingerprint("create_page", { name: "About", requestId: "write-002" });
  const pending = { fingerprint, pending: true, expiresAt: Date.now() + 60000 };
  assert.equal(cachedWriteResult(pending, fingerprint).status, 409);
  const expired = { ...pending, expiresAt: Date.now() - 1 };
  assert.equal(cachedWriteResult(expired, fingerprint), null);
  assert.equal(cachedWriteResult(null, fingerprint), null);
});
