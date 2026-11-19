import assert from "node:assert/strict";
import { test } from "node:test";
import { readLimitedText } from "../src/request-body.js";

const request = (body, headers = {}) => new Request("https://internal/test", {
  method: "POST", body, headers,
  ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
});

test("small request bodies are decoded completely", async () => {
  assert.equal(await readLimitedText(request("hello"), 5), "hello");
  assert.equal(await readLimitedText(request("hello"), 4), null);
});

test("size limits count UTF-8 bytes rather than JavaScript character units", async () => {
  assert.equal(await readLimitedText(request("日本語"), 9), "日本語");
  assert.equal(await readLimitedText(request("日本語"), 8), null);
});

test("split multi-byte UTF-8 sequences are reassembled correctly", async () => {
  const bytes = new TextEncoder().encode("あ");
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 1));
      controller.enqueue(bytes.subarray(1, 2));
      controller.enqueue(bytes.subarray(2));
      controller.close();
    },
  });
  assert.equal(await readLimitedText(request(body), 3), "あ");
});

test("streaming requests are cancelled when the byte budget is exceeded", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(20)); },
    cancel() { cancelled = true; },
  });
  assert.equal(await readLimitedText(request(body), 30), null);
  assert.equal(cancelled, true);
});

test("oversized Content-Length is rejected before body consumption", async () => {
  const raw = request("safe");
  raw.headers.set("Content-Length", "9999999");
  assert.equal(raw.headers.get("Content-Length"), "9999999");
  assert.equal(await readLimitedText(raw, 10), null);
  assert.equal(raw.bodyUsed, false);
});

test("empty requests and invalid budgets are handled explicitly", async () => {
  const empty = new Request("https://internal/test", { method: "POST" });
  assert.equal(await readLimitedText(empty, 0), "");
  await assert.rejects(readLimitedText(request("ok"), -1), RangeError);
});
