import assert from "node:assert/strict";
import { test } from "node:test";
import { stageSiteDoc, importDraftRequest } from "../src/drafts.js";
import { sha256 } from "../src/pair-code.js";
import { checkStagedSiteDoc } from "../src/site-doc-check.js";
import { skillFiles } from "../src/generated-skills.js";

const siteDoc = {
  schemaVersion: 1, siteName: "Test website", assets: {}, nodes: {},
  pageOrder: ["home"], pages: {
    home: { id: "home", name: "Home", slug: "", title: "Home", description: "", children: [] },
  },
};
const session = "12345678-1234-4234-8234-123456789abc";

test("staging a complete SiteDoc produces a secret-bearing fragment and stores opaque bytes", async () => {
  let created;
  let quotaCalled = false;
  const env = {
    PAIRINGS: {
      getByName: () => ({ fetch: async () => { quotaCalled = true; return Response.json({ allowed: true }); } }),
    },
    IMPORT_DRAFTS: {
      getByName: () => ({ fetch: async (url, init) => {
        created = { url, ...init };
        return Response.json({ ok: true });
      } }),
    },
  };
  const result = await stageSiteDoc(env, session, siteDoc);
  assert.equal(result.siteName, siteDoc.siteName);
  assert.equal(quotaCalled, true);
  const url = new URL(result.importUrl);
  assert.equal(url.origin, "https://tsumu.ebii.net");
  assert.equal(url.pathname, "/");
  const match = /^#tsumu-import=([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,64})$/.exec(url.hash);
  assert.ok(match);
  assert.equal(created.url, "https://internal/create");
  assert.equal(created.headers["X-Draft-Hash"], await sha256(match[2]));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(created.body)), siteDoc);
  assert.ok(result.expiresAt > Date.now());
});

test("draft-only links refuse insecure or malformed editor origins", async () => {
  const env = { PAIRINGS: { getByName: () => { throw new Error("should not create"); } } };
  for (const origin of ["http://example.org", "https://example.org/path", "https://example.org/?x=1", "https://user:secret@example.org/"]) {
    await assert.rejects(stageSiteDoc(env, session, siteDoc, origin), /editorOrigin/);
  }
  await assert.rejects(stageSiteDoc(env, session, { ...siteDoc, schemaVersion: 2 }), /complete Tsumu SiteDoc/);
});

test("staging rejects silently ignored style fields before allocating storage", () => {
  const sample = JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]);
  const root = Object.values(sample.nodes).find(node => node.children.length > 0);
  assert.ok(root);
  assert.ok(checkStagedSiteDoc(sample).styleDeclarations > 0);
  assert.throws(() => checkStagedSiteDoc({
    ...sample, nodes: { ...sample.nodes, [root.id]: { ...root, style: { color: "#f00" } } },
  }), /unsupported node field/);
  assert.throws(() => checkStagedSiteDoc({
    ...sample, nodes: { ...sample.nodes, [root.id]: { ...root,
      styles: { base: { fontSize: "64px", default: {} } } } },
  }), /expected a CSS declaration object/);
  assert.throws(() => checkStagedSiteDoc({
    ...sample, nodes: { ...sample.nodes, [root.id]: { ...root,
      styles: { base: { default: { backgroundColor: 123 } } } } },
  }), /string values/);
  assert.throws(() => checkStagedSiteDoc({
    ...sample, nodes: Object.fromEntries(Object.entries(sample.nodes).map(([id, node]) =>
      [id, { ...node, styles: { base: { default: {} } } }])),
  }), /have no CSS declarations/);
});


test("staging rejects invalid semantic and native element settings with precise paths", () => {
  const original = JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]);
  const changed = mutate => {
    const doc = structuredClone(original);
    mutate(doc);
    return doc;
  };
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    delete doc.nodes.node_heading.semantic;
  })), /nodes\.node_heading\.semantic/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.semantic = "heading";
  })), /nodes\.node_heading\.semantic/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.image = { src: "/hero.jpg", alt: "Hero", width: "800", height: 600 };
  })), /nodes\.node_heading\.image/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.link = { kind: "internal" };
  })), /nodes\.node_heading\.link/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.field = { kind: "input", inputType: "unsupported" };
  })), /nodes\.node_heading\.field/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.scripts = [{ id: "s1", trigger: "load", steps: [{ id: "bad", kind: "mystery" }] }];
  })), /nodes\.node_heading\.scripts/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.darkStyles = { base: { default: { color: 123 } } };
  })), /nodes\.node_heading\.darkStyles\.base\.default\.color/);
});

test("staging rejects invalid tree, references and assets before allocating a draft", async () => {
  const original = JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]);
  const changed = mutate => {
    const doc = structuredClone(original);
    mutate(doc);
    return doc;
  };
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_hero.children.push("node_heading");
  })), /nodes\.node_hero\.children/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    const base = doc.nodes.node_heading;
    doc.nodes.cycle_a = { ...base, id: "cycle_a", children: ["cycle_b"] };
    doc.nodes.cycle_b = { ...base, id: "cycle_b", children: ["cycle_a"] };
  })), /cyclic element hierarchy/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.nodes.node_heading.image = { src: "", alt: "", width: 200, height: 100, assetId: "missing" };
  })), /nodes\.node_heading\.image\.assetId/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.assets.logo = { id: "logo", name: "logo.svg", width: "10", height: 20 };
  })), /assets\.logo/);
  assert.throws(() => checkStagedSiteDoc(changed(doc => {
    doc.pages.page_about = { id: "page_about", name: "About", slug: "about", title: "About", description: "", children: ["node_hero"] };
    doc.pageOrder.push("page_about");
  })), /multiple parents or pages/);
  let quotaCalled = false;
  const env = { PAIRINGS: { getByName() { quotaCalled = true; throw new Error("quota called"); } } };
  await assert.rejects(stageSiteDoc(env, session, changed(doc => {
    doc.nodes.node_heading.semantic = null;
  })), /nodes\.node_heading\.semantic/);
  assert.equal(quotaCalled, false);
});

test("browser draft claim and completion require a secret and an allowed Origin", async () => {
  const path = "https://mcp.tsumu.ebii.net/drafts/" + session + "/claim";
  const noOrigin = await importDraftRequest(new Request(path, { method: "POST" }), {});
  assert.equal(noOrigin.status, 403);
  const preflight = await importDraftRequest(new Request(path, {
    method: "OPTIONS", headers: { Origin: "https://selfhost.example.net" },
  }), {});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://selfhost.example.net");
  const denied = await importDraftRequest(new Request(path, {
    method: "POST", headers: { Origin: "https://tsumu.ebii.net" },
  }), {});
  assert.equal(denied.status, 404);

  let forwarded = 0;
  const env = { IMPORT_DRAFTS: { getByName: () => ({ fetch: async (url, init) => {
    forwarded++;
    assert.equal(url, "https://internal/claim");
    assert.equal(JSON.parse(init.body).secret, "s".repeat(43));
    return Response.json({ doc: JSON.stringify(siteDoc), receipt: session });
  } }) } };
  const accepted = await importDraftRequest(new Request(path, {
    method: "POST",
    headers: { Origin: "https://tsumu.ebii.net", Authorization: "Bearer " + "s".repeat(43) },
  }), env);
  assert.equal(accepted.status, 200);
  assert.equal(forwarded, 1);
  assert.deepEqual(JSON.parse((await accepted.json()).doc), siteDoc);
  assert.equal(accepted.headers.get("cache-control"), "no-store");
});
