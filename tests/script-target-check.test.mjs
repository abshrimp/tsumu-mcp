import assert from "node:assert/strict";
import { test } from "node:test";
import { checkStagedSiteDoc } from "../src/site-doc-check.js";
import { stageSiteDoc } from "../src/drafts.js";
import { skillFiles } from "../src/generated-skills.js";

const sample = () => JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]);
const step = (kind, target) => ({ id: "action", kind, target });
const script = (steps) => ({ id: "click-script", trigger: "click", steps });
function sourceSite() {
  const doc = sample();
  const [ownerId] = doc.pages.page_home.children;
  doc.nodes[ownerId].attrId = "button-dom-id";
  doc.nodes[ownerId].scripts = [script([])];
  doc.nodes.panel_node = {
    id: "panel_node", type: "box", name: "Panel", semantic: "auto",
    text: null, children: [], styles: { base: { default: { display: "block" } } },
    attrId: "panel-dom-id",
  };
  doc.pages.page_home.children.push("panel_node");
  return { doc, ownerId };
}

test("stage diagnostics validate actual HTML attrId targets throughout nested steps", () => {
  const { doc, ownerId } = sourceSite();
  const actions = [
    step("show", "panel-dom-id"),
    { id: "self", kind: "toggle", target: "@self" },
    { id: "repeat", kind: "repeat", times: 2, then: [
      { id: "if", kind: "if",
        cond: { subject: "visible", target: "panel-dom-id" },
        conditions: [{ subject: "var", target: "", left: "{enabled}", op: "eq", value: "yes", and: true }],
        then: [step("scroll-to", "panel-dom-id")],
        else: [{ id: "else", kind: "set-state", target: "panel-dom-id", state: "open" }],
      },
    ] },
    { id: "foreach", kind: "for-each", array: "items", then: [
      { id: "disable", kind: "set-enabled", target: "panel-dom-id", op: "disable" },
    ] },
  ];
  doc.nodes[ownerId].scripts[0].steps = actions;
  doc.pages.page_home.pageScripts = [script([step("hide", "panel-dom-id")])];
  const before = structuredClone(doc);
  assert.doesNotThrow(() => checkStagedSiteDoc(doc));
  assert.deepEqual(doc, before, "validation must not rewrite SiteDoc");
});

test("a node key is not an element target even if the element exists", () => {
  const { doc, ownerId } = sourceSite();
  doc.nodes[ownerId].scripts[0].steps = [step("show", "panel_node")];
  assert.throws(() => checkStagedSiteDoc(doc), /nodes\..*scripts\[0\]\.steps\[0\]\.target.*SiteDoc node id.*panel-dom-id/);
  delete doc.nodes.panel_node.attrId;
  assert.throws(() => checkStagedSiteDoc(doc), /assign nodes\.panel_node\.attrId/);
});

test("missing, cross-page and page-level self targets are rejected", () => {
  const { doc, ownerId } = sourceSite();
  for (const target of ["", "not-present", "on-other-page"]) {
    const changed = structuredClone(doc);
    changed.nodes[ownerId].scripts[0].steps = [step("hide", target)];
    if (target === "on-other-page") {
      changed.pages.second = { id: "second", name: "Second", slug: "second",
        title: "Second", description: "", children: ["foreign"] };
      changed.pageOrder.push("second");
      changed.nodes.foreign = { ...structuredClone(changed.nodes.panel_node),
        id: "foreign", attrId: target };
    }
    assert.throws(() => checkStagedSiteDoc(changed), /target|attrId/i, target);
  }
  doc.pages.page_home.pageScripts = [script([step("show", "@self")])];
  assert.throws(() => checkStagedSiteDoc(doc), /pageScripts\[0\]\.steps\[0\]\.target.*@self requires/);
});

test("a nested joined condition and alternate branch cannot hide missing targets", () => {
  const { doc, ownerId } = sourceSite();
  doc.nodes[ownerId].scripts[0].steps = [{
    id: "outer", kind: "if",
    cond: { subject: "var", target: "", left: "count", op: "gt", value: "1" },
    conditions: [{ subject: "hovered", target: "missing", and: false }],
    then: [], else: [{ id: "branch", kind: "show", target: "panel-dom-id" }],
  }];
  assert.throws(() => checkStagedSiteDoc(doc), /conditions\[0\]\.target.*missing/);
  doc.nodes[ownerId].scripts[0].steps[0].conditions[0].target = "panel-dom-id";
  doc.nodes[ownerId].scripts[0].steps[0].else[0].target = "wrong";
  assert.throws(() => checkStagedSiteDoc(doc), /\.else\[0\]\.target.*wrong/);
});

test("component masters allow their own targets, not unrelated page targets", () => {
  const { doc } = sourceSite();
  const master = { ...structuredClone(doc.nodes.panel_node), id: "component-root",
    attrId: "component-root-dom", children: ["component-child"], scripts: [script([step("show", "child-dom")])] };
  const child = { ...structuredClone(doc.nodes.panel_node), id: "component-child", attrId: "child-dom" };
  doc.nodes["component-root"] = master;
  doc.nodes["component-child"] = child;
  doc.components = { card: { id: "card", name: "Card", rootId: "component-root" } };
  doc.nodes.card_instance = { ...structuredClone(doc.nodes.panel_node), id: "card_instance",
    type: "instance", componentId: "card", attrId: "instance-dom" };
  doc.pages.page_home.children.push("card_instance");
  assert.doesNotThrow(() => checkStagedSiteDoc(doc));
  doc.nodes["component-root"].scripts[0].steps[0].target = "panel-dom-id";
  assert.throws(() => checkStagedSiteDoc(doc), /nodes\.component-root\.scripts.*panel-dom-id/);
});

test("rejected references do not consume the draft creation quota", async () => {
  const { doc, ownerId } = sourceSite();
  doc.nodes[ownerId].scripts[0].steps = [step("show", "panel_node")];
  let touched = false;
  const env = { PAIRINGS: { getByName() { touched = true; throw Error("unexpected quota"); } },
    IMPORT_DRAFTS: { getByName() { touched = true; throw Error("unexpected draft"); } } };
  await assert.rejects(stageSiteDoc(env, "test-session", doc), /SiteDoc node id/);
  assert.equal(touched, false);
});
