import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { test } from "node:test";

const script = readFileSync(new URL("../public/authorize-site.js", import.meta.url), "utf8");
const EDITOR = "https://tsumu.ebii.net";
const CODE_A = "ABCDE-FGHJK-LMNPQ-RSTUV";
const CODE_B = "BCDEF-GHJKL-MNPQR-STUVW";

function page({ blockedAt = Infinity } = {}) {
  function element(tagName = "div") {
    return {
      tagName, hidden: true, disabled: false, checked: false,
      children: [], events: {}, textContent: "",
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = [...items]; },
      addEventListener(type, callback) { this.events[type] = callback; },
      querySelectorAll(tag) {
        const matches = [];
        function walk(node) {
          for (const child of node.children ?? []) {
            if (child.tagName === tag) matches.push(child);
            walk(child);
          }
        }
        walk(this);
        return matches;
      },
    };
  }
  const frame = element("iframe");
  frame.contentWindow = {};
  const section = element();
  const list = element();
  const edit = element("input");
  edit.checked = true;
  const error = element();
  const codes = { value: "" };
  const approve = element("button");
  let submitted = 0;
  const form = {
    querySelector() { return codes; },
    requestSubmit() { submitted++; },
  };
  const elements = {
    "official-site-directory": frame,
    "official-sites": section,
    "official-site-list": list,
    "official-edit": edit,
    "official-site-error": error,
    "official-site-authorization": form,
    "approve-selected-sites": approve,
  };
  const handlers = {};
  const opened = [];
  const window = {
    addEventListener(name, handler) { handlers[name] = handler; },
    open(url) {
      if (opened.length >= blockedAt) return null;
      const child = { url };
      opened.push(child);
      return child;
    },
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
    frame, section, list, edit, error, approve, opened, codes,
    submitCount: () => submitted,
    sites(sites, overrides = {}) {
      handlers.message({
        origin: EDITOR, source: frame.contentWindow,
        data: { type: "tsumu-mcp-sites", nonce, sites, ...overrides },
      });
    },
    choose(index) {
      const input = list.children[index].children[0];
      input.checked = !input.checked;
      input.events.change();
    },
    start() { approve.events.click(); },
    message(data, source = opened[0]) {
      handlers.message({ origin: EDITOR, source, data });
    },
    otherOrigin(data, source = opened[0]) {
      handlers.message({ origin: "https://attacker.example", source, data });
    },
  };
}

test("empty or forged site lists never show the selection section", () => {
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

test("multiple sites need explicit selection and are claimed only after every editor confirms", () => {
  const ui = page();
  const name = "<img src=x onerror=alert(1)>";
  ui.sites([
    { id: "site-a", name, canEdit: true },
    { id: "site-b", name: "Read only", canEdit: false },
  ]);
  assert.equal(ui.section.hidden, false);
  assert.equal(ui.list.children.length, 2);
  assert.equal(ui.list.children[0].children[1].textContent, name);
  assert.equal(ui.opened.length, 0);
  assert.equal(ui.approve.disabled, true);
  ui.choose(0);
  ui.choose(1);
  assert.equal(ui.approve.disabled, false);
  ui.start();
  assert.equal(ui.opened.length, 1, "only one popup may open per user gesture");
  assert.equal(ui.opened[0].url, EDITOR + "/sites/site-a#mcp-select=1");
  ui.otherOrigin({ type: "tsumu-mcp-site-ready", siteId: "site-a", ok: true, code: CODE_A });
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "site-b", ok: true, code: CODE_B });
  assert.equal(ui.submitCount(), 0);
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "site-a", ok: true, code: CODE_A });
  assert.equal(ui.submitCount(), 0, "a partial pairing must not authorize the remaining sites");
  assert.equal(ui.approve.disabled, false, "the next site needs its own click");
  ui.start();
  assert.equal(ui.opened.length, 2);
  assert.equal(ui.opened[1].url, EDITOR + "/sites/site-b#mcp-select=0");
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "site-b", ok: true, code: CODE_B }, ui.opened[1]);
  assert.equal(ui.submitCount(), 1);
  assert.deepEqual(JSON.parse(ui.codes.value), [CODE_A, CODE_B]);
});

test("unselected sites are never opened or granted", () => {
  const ui = page();
  ui.sites([{ id: "first", name: "First", canEdit: true }, { id: "second", name: "Second", canEdit: true }]);
  ui.choose(1);
  ui.start();
  assert.equal(ui.opened.length, 1);
  assert.equal(ui.opened[0].url, EDITOR + "/sites/second#mcp-select=1");
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "second", ok: true, code: CODE_A });
  assert.deepEqual(JSON.parse(ui.codes.value), [CODE_A]);
});

test("viewer sites cannot be granted editing permission", () => {
  const ui = page();
  ui.sites([{ id: "readonly", name: "Viewer", canEdit: false }]);
  ui.choose(0);
  ui.start();
  assert.equal(ui.opened[0].url, EDITOR + "/sites/readonly#mcp-select=0");
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "readonly", ok: false });
  assert.equal(ui.submitCount(), 0);
  assert.equal(ui.error.hidden, false);
});

test("blocked popups and missing confirmations never submit an OAuth grant", () => {
  const ui = page({ blockedAt: 1 });
  ui.sites([{ id: "a", name: "A", canEdit: true }, { id: "b", name: "B", canEdit: true }]);
  ui.choose(0);
  ui.choose(1);
  ui.start();
  assert.equal(ui.opened.length, 1);
  ui.message({ type: "tsumu-mcp-site-ready", siteId: "a", ok: true, code: CODE_A });
  ui.start();
  assert.equal(ui.opened.length, 1, "blocked second popup must not submit partial consent");
  assert.equal(ui.submitCount(), 0);
  assert.equal(ui.error.hidden, false);
});

test("site selection is limited to twelve and duplicate directory IDs cannot be selected twice", () => {
  const ui = page();
  ui.sites([
    ...Array.from({ length: 14 }, (_, i) => ({ id: "site-" + i, name: "Site " + i, canEdit: true })),
    { id: "site-0", name: "Duplicate", canEdit: true },
  ]);
  assert.equal(ui.list.children.length, 14);
  for (let i = 0; i < 13; i++) ui.choose(i);
  assert.equal(ui.list.children[12].children[0].checked, false);
  ui.start();
  assert.equal(ui.opened.length, 1, "only one editor opens per user gesture");
  assert.equal(ui.opened[0].url, EDITOR + "/sites/site-0#mcp-select=1");
});
