import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { test } from "node:test";

const script = readFileSync(new URL("../public/authorize-site.js", import.meta.url), "utf8");
const EDITOR = "https://tsumu.ebii.net";

function page() {
  function element(tagName = "div") {
    return {
      tagName, hidden: true, disabled: false, children: [], events: {}, textContent: "",
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = [...items]; },
      addEventListener(type, callback) { this.events[type] = callback; },
      querySelectorAll(tag) { return this.children.filter(item => item.tagName === tag); },
    };
  }
  const frame = element("iframe");
  frame.contentWindow = {};
  const section = element();
  const list = element();
  const edit = element("input");
  edit.checked = true;
  const error = element();
  const code = { value: "" };
  let submitted = 0;
  const form = {
    querySelector() { return code; },
    requestSubmit() { submitted++; },
  };
  const elements = {
    "official-site-directory": frame,
    "official-sites": section,
    "official-site-list": list,
    "official-edit": edit,
    "official-site-error": error,
    "official-site-authorization": form,
  };
  const handlers = {};
  const opened = [];
  const window = {
    addEventListener(name, handler) { handlers[name] = handler; },
    open(url) { const child = { url }; opened.push(child); return child; },
  };
  const document = {
    documentElement: { lang: "ja" },
    getElementById(id) { return elements[id]; },
    createElement(tag) { return element(tag); },
  };
  runInNewContext(script, { document, window, crypto: webcrypto, Uint8Array,
    btoa: globalThis.btoa, setTimeout: () => 1, clearTimeout: () => {} });
  const nonce = frame.src.split("#nonce=")[1];
  assert.ok(/^[A-Za-z0-9_-]{24}$/.test(nonce));
  assert.equal(frame.src.split("#")[0], EDITOR + "/mcp/sites-bridge");

  return {
    frame, section, list, edit, error, opened, code,
    submitCount: () => submitted,
    sites(sites, overrides = {}) {
      handlers.message({
        origin: EDITOR, source: frame.contentWindow,
        data: { type: "tsumu-mcp-sites", nonce, sites, ...overrides },
      });
    },
    message(data, source = opened[0]) {
      handlers.message({ origin: EDITOR, source, data });
    },
    otherOrigin(data) {
      handlers.message({ origin: "https://attacker.example", source: opened[0], data });
    },
  };
}

test("empty or unavailable official sites do not display the selection section", () => {
  const ui = page();
  assert.equal(ui.section.hidden, true);
  ui.sites([]);
  assert.equal(ui.section.hidden, true);
  ui.sites([{ id: "../bad", name: "Hostile", canEdit: true }]);
  assert.equal(ui.section.hidden, true);
  assert.equal(ui.list.children.length, 0);
  ui.sites([{ id: "a", name: "Good", canEdit: true }], { nonce: "wrong" });
  assert.equal(ui.section.hidden, true);
});

test("the OAuth page renders only validated site metadata and requires an explicit click", () => {
  const ui = page();
  const name = "<img src=x onerror=alert(1)>";
  ui.sites([{ id: "site-a", name, canEdit: true },
    { id: "site-b", name: "Read-only", canEdit: false }]);
  assert.equal(ui.section.hidden, false);
  assert.equal(ui.list.children.length, 2);
  assert.equal(ui.list.children[0].children[0].textContent, name);
  assert.equal(ui.opened.length, 0, "site metadata must not trigger a pairing");
  assert.equal(ui.submitCount(), 0);
  ui.list.children[0].events.click();
  assert.equal(ui.opened.length, 1);
  assert.equal(ui.opened[0].url, EDITOR + "/sites/site-a#mcp-select=1");
  ui.otherOrigin({ type: "tsumu-mcp-site-ready", siteId: "site-a", ok: true, code: "ABCDE-FGHJK-LMNPQ-RSTUV" });
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "site-b", ok: true, code: "ABCDE-FGHJK-LMNPQ-RSTUV" });
  assert.equal(ui.submitCount(), 0);
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "site-a", ok: true, code: "ABCDE-FGHJK-LMNPQ-RSTUV" });
  assert.equal(ui.submitCount(), 1);
  assert.equal(ui.code.value, "ABCDE-FGHJK-LMNPQ-RSTUV");
});

test("viewer sites are always paired without editing permission", () => {
  const ui = page();
  ui.sites([{ id: "readonly", name: "Viewer", canEdit: false }]);
  ui.list.children[0].events.click();
  assert.equal(ui.opened[0].url, EDITOR + "/sites/readonly#mcp-select=0");
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "readonly", ok: false });
  assert.equal(ui.submitCount(), 0);
});
