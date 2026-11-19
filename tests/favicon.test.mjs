import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { consentPage } from "../src/consent-page.js";
import { consentCsp } from "../src/consent-csp.js";

test("public favicons match the canonical Tsumu artwork", async () => {
  const read = path => readFile(new URL("../" + path, import.meta.url));
  assert.deepEqual(await read("public/favicon.svg"), await read("assets/tsumu.svg"));
  assert.deepEqual(await read("public/favicon.png"), await read("assets/tsumu-icon.png"));
});

test("authorization pages reference reachable icons allowed by CSP", () => {
  const html = consentPage({
    clientName: "Test", clientDomain: null, redirectHost: "example.org",
    redirectIsLoopback: false, scope: [],
  }, "handle", new Request("https://mcp.tsumu.ebii.net/authorize"), "en");
  assert.match(html, /href='\/favicon.png'/);
  assert.match(html, /href='\/favicon.svg'/);
  assert.match(consentCsp("https://example.org/callback"), /img-src 'self'/);
});
