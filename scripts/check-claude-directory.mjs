import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = join(repoRoot, "plugins", "claude");
const files = new Set();
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else {
      assert.ok(entry.isFile(), "Unsupported symlink or special file: " + absolute);
      files.add(relative(dir, absolute).split(sep).join("/"));
    }
  }
}
visit(dir);
const expected = [
  ".claude-plugin/icon.png",
  ".claude-plugin/plugin.json",
  ".mcp.json",
  "README.md",
].sort();
assert.deepEqual([...files].sort(), expected, "Claude directory folder must contain only approved files");

const manifest = JSON.parse(readFileSync(join(dir, ".claude-plugin", "plugin.json"), "utf8"));
const allowed = new Set([
  "name", "displayName", "version", "description", "author", "homepage",
  "repository", "license", "keywords", "mcpServers", "icon",
  "privacyPolicyUrl", "documentationUrl", "supportUrl", "termsOfServiceUrl",
]);
assert.ok(Object.keys(manifest).every(key => allowed.has(key)), "Unexpected manifest field");
assert.equal(manifest.name, "tsumu");
assert.equal(manifest.mcpServers, "./.mcp.json");
assert.equal(manifest.icon, "./.claude-plugin/icon.png");
assert.equal(manifest.license, "MIT");
assert.equal(manifest.author?.name, "abshrimp");
assert.ok(manifest.version);
assert.ok(manifest.privacyPolicyUrl.startsWith("https://"));
assert.ok(existsSync(join(repoRoot, "docs", "PRIVACY.md")));

const mcp = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8"));
assert.deepEqual(mcp, {
  mcpServers: { tsumu: { type: "http", url: "https://mcp.tsumu.ebii.net/mcp" } },
});
for (const server of Object.values(mcp.mcpServers)) {
  assert.equal(server.headers, undefined, "Never bundle credentials");
  assert.equal(server.command, undefined, "Do not ship a local executable");
}

const png = readFileSync(join(dir, ".claude-plugin", "icon.png"));
assert.ok(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), "Must be a real PNG");
assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
assert.equal(width, height, "Icon must be square");
assert.ok(width >= 512 && width <= 2048, "Icon dimensions must be 512 to 2048px");
assert.ok(png.length < 2 * 1024 * 1024, "Icon must be smaller than 2 MiB");
let hasImageData = false;
let hasEnd = false;
for (let offset = 8; offset < png.length;) {
  assert.ok(offset + 12 <= png.length, "Incomplete PNG chunk header");
  const end = offset + 8 + png.readUInt32BE(offset);
  assert.ok(end + 4 <= png.length, "Incomplete PNG chunk data");
  assert.equal(crc32(png.subarray(offset + 4, end)), png.readUInt32BE(end), "Invalid PNG checksum");
  const type = png.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") hasImageData = true;
  if (type === "IEND") {
    assert.equal(end + 4, png.length, "Unexpected data after PNG end");
    hasEnd = true;
  }
  offset = end + 4;
}
assert.ok(hasImageData && hasEnd, "Icon must contain PNG image data and an end marker");

console.log("Claude directory plugin isolated: four allowed files, safe remote MCP, icon, policy link");
