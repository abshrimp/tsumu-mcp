import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const endpoint = "https://mcp.tsumu.ebii.net/mcp";
const version = read("package.json").version;
const lockfile = read("package-lock.json");
assert.equal(lockfile.version, version, "Lockfile version must match package.json");
assert.equal(lockfile.packages[""].version, version, "Lockfile root package version must match package.json");

const cursor = read(".cursor-plugin/plugin.json");
const cursorMcp = read("mcp.json");
const claude = read(".claude-plugin/plugin.json");
const claudeMcp = read(".mcp.json");
const claudeMarketplace = read(".claude-plugin/marketplace.json");
const gemini = read("gemini-extension.json");
const antigravity = read(".antigravity-plugin/plugin.json");
const antigravityMcp = read("mcp_config.json");
const wrangler = read("wrangler.jsonc");
const claudeDirectory = read("plugins/claude/.claude-plugin/plugin.json");

for (const [provider, config, server] of [
  ["Cursor", cursorMcp, { url: endpoint }],
  ["Claude Code", claudeMcp, { type: "http", url: endpoint }],
  ["Gemini CLI", gemini, { httpUrl: endpoint, authProviderType: "dynamic_discovery" }],
  ["Antigravity", antigravityMcp, { serverUrl: endpoint }],
]) {
  assert.deepEqual(config.mcpServers, { tsumu: server }, provider + ": unexpected MCP server configuration");
}

const declared = Object.entries(wrangler.exports);
const bound = wrangler.durable_objects.bindings.map(binding => binding.class_name).sort();
assert.deepEqual(declared.map(([name]) => name).sort(), bound, "Durable Object exports must match bindings");
for (const [, config] of declared) {
  assert.deepEqual(config, { type: "durable-object", storage: "sqlite" });
}

for (const [provider, manifest] of [
  ["Cursor", cursor],
  ["Claude Code", claude],
  ["Claude Directory", claudeDirectory],
  ["Antigravity", antigravity],
]) {
  assert.equal(manifest.name, "tsumu", provider + ": plugin name");
  assert.equal(manifest.version, version, provider + ": version mismatch");
  assert.equal(manifest.license, "MIT", provider + ": license mismatch");
  assert.ok(manifest.description?.includes("Tsumu"), provider + ": description missing");
}
assert.equal(gemini.name, "tsumu-mcp");
assert.equal(gemini.version, version);
assert.equal(cursor.mcpServers, "mcp.json");
assert.equal(claudeMarketplace.name, "tsumu-plugins");
assert.deepEqual(claudeMarketplace.plugins.map(x => [x.name, x.source]), [["tsumu", "./plugins/claude"]]);
for (const manifest of [cursor, antigravity]) {
  assert.ok(existsSync(new URL("../" + manifest.logo, import.meta.url)), "Missing logo: " + manifest.logo);
}
assert.equal(antigravity["$schema"], "https://antigravity.google/schemas/v1/plugin.json");
for (const path of ["README.md", "docs/INSTALL.md", "docs/PUBLISHING.md"]) {
  assert.ok(existsSync(new URL("../" + path, import.meta.url)), "Missing documentation: " + path);
}
const indexSource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
assert.ok(indexSource.includes(endpoint), "MCP URI does not match production resource metadata");
const serverSource = readFileSync(new URL("../src/mcp.js", import.meta.url), "utf8");
assert.ok(serverSource.includes(`new McpServer({ name: "tsumu", version: "${version}" })`),
  "MCP server version must match package.json");

console.log("Cross-client distribution manifests validated for Claude, Cursor, Gemini CLI, and Antigravity");
