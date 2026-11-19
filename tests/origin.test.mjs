import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedBrowserOrigin } from "../src/origin.js";

test("accepts canonical HTTPS origins from arbitrary self-hosted domains", () => {
  for (const origin of ["https://tsumu.ebii.net", "https://tsumu.example.org", "https://site.example.org:8443", "https://xn--eckwd4c7c.example"]) {
    assert.equal(allowedBrowserOrigin(origin), origin);
  }
});

test("accepts loopback HTTP origins for local development", () => {
  for (const origin of ["http://localhost", "http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    assert.equal(allowedBrowserOrigin(origin), origin);
  }
});

test("rejects opaque, insecure remote, malformed, and non-origin URLs", () => {
  for (const origin of [
    null, "", "null", "file://", "data:text/plain,test",
    "http://tsumu.example.org", "http://192.168.1.25:3000", "http://sub.localhost:3000",
    "https://example.org/", "https://example.org/path", "https://example.org?query=1",
    "https://user@example.org", "https://example.org#fragment", "https://example.org:443",
    "HTTPS://example.org", "https://a.example.org https://b.example.org",
  ]) {
    assert.equal(allowedBrowserOrigin(origin), null, String(origin));
  }
});
