import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTsumuSiteDoc } from "../src/generated/tsumu-site-doc-validator.mjs";
import { checkStagedSiteDoc } from "../src/site-doc-check.js";
import { stageSiteDoc } from "../src/drafts.js";
import { skillFiles } from "../src/generated-skills.js";

const sample = () => JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]);
const session = "12345678-1234-4234-8234-123456789abc";

test("the bundled Tsumu importer accepts the canonical editable example", () => {
  const doc = sample();
  assert.ok(checkStagedSiteDoc(doc));
  assert.doesNotThrow(() => validateTsumuSiteDoc(doc));
});

test("the authoritative importer catches fields missing from the MCP diagnostic precheck", () => {
  const mutations = [
    doc => { doc.baseWidth = "wide"; },
    doc => { doc.pwa = { enabled: "yes" }; },
    doc => { doc.loadingScreen = { enabled: "yes" }; },
    doc => { doc.customFonts = "not-an-array"; },
  ];
  for (const mutate of mutations) {
    const doc = sample();
    mutate(doc);
    assert.doesNotThrow(() => checkStagedSiteDoc(doc));
    assert.throws(() => validateTsumuSiteDoc(doc), /invalid|Invalid|structure|references|element settings/i);
  }
});

test("an importer-rejected SiteDoc never consumes quota or creates an import link", async () => {
  const doc = sample();
  doc.pwa = { enabled: "yes" };
  let quotaCalls = 0;
  let draftCalls = 0;
  const env = {
    PAIRINGS: { getByName: () => { quotaCalls++; throw new Error("unexpected quota access"); } },
    IMPORT_DRAFTS: { getByName: () => { draftCalls++; throw new Error("unexpected draft access"); } },
  };
  await assert.rejects(stageSiteDoc(env, session, doc), /Invalid SiteDoc \(Tsumu importer\)/);
  assert.equal(quotaCalls, 0);
  assert.equal(draftCalls, 0);
});
