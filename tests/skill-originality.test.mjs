import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { skillFiles } from "../src/generated-skills.js";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

test("Tsumu new-site instructions explicitly design freely before SiteDoc conversion", () => {
  const skill = read("skills/tsumu-build-site/SKILL.md");
  const design = skill.indexOf("Phase 1 — create an original website concept");
  const convert = skill.indexOf("Phase 2 — translate that design");
  const schema = skill.indexOf("**Before constructing any SiteDoc:**");
  assert.ok(design >= 0 && convert > design && schema > convert, "Free design precedes schema-based conversion");
  assert.match(skill, /standalone HTML\/CSS prototype/);
  assert.match(skill, /not an instruction to reskin a sample JSON document/);
  assert.match(skill, /example JSON and replace its copy or palette/);
  assert.match(skill, /Do not require a live preview if none is available/);
  assert.match(skill, /closest valid editable representation/);
  assert.match(skill, /stage_site_doc.*does \*\*not\*\* accept the Phase 1 HTML prototype/);
  assert.match(skill, /If the user explicitly requests a specific template/);
});

test("SiteDoc reference is a schema example, not a website template", () => {
  const reference = read("skills/tsumu-build-site/references/site-doc.md");
  assert.match(reference, /only as a valid example of the SiteDoc schema/);
  assert.match(reference, /It is not a site design template/);
  assert.match(reference, /skills\/tsumu\/references\/site-doc\.md/);
});

test("Claude distribution and MCP-served Skill instructions match canonical source", () => {
  for (const file of ["SKILL.md", "references/site-doc.md"]) {
    const canonical = read("skills/tsumu-build-site/" + file);
    assert.equal(read("plugins/claude/skills/tsumu-build-site/" + file), canonical);
    assert.equal(skillFiles["tsumu-build-site/" + file], canonical);
  }
});
