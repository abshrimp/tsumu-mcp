import assert from "node:assert/strict";
import { test } from "node:test";
import { canCompleteDraft } from "../src/draft-lease.js";

const now = 1_000_000;
const valid = {
  ready: true,
  hash: "hash",
  expiresAt: now + 60_000,
  lease: { hash: "receipt", until: now + 10_000 },
};

test("only an unexpired claim receipt may complete a draft", () => {
  assert.equal(canCompleteDraft(valid, "hash", "receipt", now), true);
  assert.equal(canCompleteDraft(valid, "wrong", "receipt", now), false);
  assert.equal(canCompleteDraft(valid, "hash", "wrong", now), false);
  assert.equal(canCompleteDraft(valid, "hash", "receipt", valid.lease.until), false);
  assert.equal(canCompleteDraft(valid, "hash", "receipt", valid.expiresAt), false);
  assert.equal(canCompleteDraft({ ...valid, ready: false }, "hash", "receipt", now), false);
  assert.equal(canCompleteDraft({ ...valid, lease: null }, "hash", "receipt", now), false);
  assert.equal(canCompleteDraft(null, "hash", "receipt", now), false);
});
