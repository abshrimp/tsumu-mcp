import { cp, mkdir, readdir, rm } from "node:fs/promises";

const root = new URL("../skills/", import.meta.url);
const dest = new URL("../plugins/claude/skills/", import.meta.url);
const entries = await readdir(root, { withFileTypes: true });
if (entries.length < 3 || entries.some(entry => !entry.isDirectory())) {
  throw new Error("Expected at least three canonical Skill directories in skills/");
}
// Only this generated Skill directory is replaced; manifests, MCP config, and icons are preserved.
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const entry of entries) {
  await cp(new URL(entry.name + "/", root), new URL(entry.name + "/", dest), { recursive: true });
}
console.log("Synchronized Claude marketplace Skills from skills/");
