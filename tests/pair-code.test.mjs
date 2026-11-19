import assert from "node:assert/strict";
import { test } from "node:test";
import { pairingCode, normalizeCode, sha256 } from "../src/pair-code.js";

test("pairing codes are random and have a fixed alphabet", () => {
  const codes = new Set(Array.from({ length: 100 }, pairingCode));
  assert.equal(codes.size, 100);
  for (const code of codes) {
    assert.match(code, /^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
    assert.equal(normalizeCode(code.toLowerCase().replaceAll("-", "")), code.replaceAll("-", ""));
  }
});

test("reject missing and ambiguous code characters", () => {
  for (const code of ["", "A".repeat(20), "0".repeat(20), "1".repeat(20), "I".repeat(20), "O".repeat(20), "Ａ".repeat(20)]) {
    if (code === "A".repeat(20)) assert.equal(normalizeCode(code), code);
    else assert.equal(normalizeCode(code), null);
  }
  assert.equal(normalizeCode(null), null);
});

test("hash is stable and never includes the original code", async () => {
  const a = await sha256("secret-value");
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.equal(a, await sha256("secret-value"));
  assert.notEqual(a, await sha256("different"));
});
