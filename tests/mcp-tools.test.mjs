import assert from "node:assert/strict";
import { test } from "node:test";
import { serveAuthenticatedMcp } from "../src/mcp-handler.js";
import { MAX_DRAFT_BYTES, MAX_MCP_REQUEST_BYTES } from "../src/draft-limits.js";

const sessionId = "12345678-1234-4123-8123-123456789abc";
const auth = { auth: { scope: ["tsumu:access"] }, props: { sessionId } };
const env = {
  BROWSER_SESSIONS: {
    getByName(id) {
      assert.equal(id, sessionId);
      return {
        async fetch(_request, options) {
          const message = JSON.parse(options.body);
          if (message.action === "create_site") {
            return Response.json({ result: { id: "site-2", name: message.args.name, requiresReconnect: true } });
          }
          if (message.action === "create_page") {
            return Response.json({ result: { pageId: "page-2", name: message.args.name, savedToBrowser: true } });
          }
          if (message.action === "apply_operations") {
            return Response.json({ result: { applied: message.args.operations } });
          }
          if (message.action === "list_sites") {
            return Response.json({ result: [{ id: "demo", name: "Demo" }] });
          }
          return Response.json({ error: "Unexpected action" }, { status: 400 });
        },
      };
    },
  },
};

async function rpc(method, params, ctx = auth, bindings = env) {
  const request = new Request("https://mcp.tsumu.ebii.net/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) }),
  });
  const response = await serveAuthenticatedMcp(request, bindings, ctx);
  const body = await response.text();
  const messages = response.headers.get("Content-Type")?.includes("text/event-stream")
    ? body.split("\n").filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)))
    : response.headers.get("Content-Type")?.includes("application/json")
      ? [JSON.parse(body)] : [];
  return { response, body, message: messages.find(x => x.id === 1) };
}

test("authenticated HTTP endpoint advertises typed editing and creation tools", async () => {
  const { response, body, message } = await rpc("tools/list");
  assert.equal(response.status, 200, body);
  assert.ok(message?.result?.tools, body);
  const tools = message.result.tools;
  assert.deepEqual(tools.map(t => t.name).sort(), [
    "apply_operations", "create_page", "create_site", "get_element", "get_page", "get_site_doc_spec", "insert_element", "list_pages", "list_sites", "set_style", "set_text", "stage_site_doc",
  ]);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description);
    assert.equal(typeof tool.annotations.title, "string");
    assert.ok(tool.annotations.title.trim());
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
    assert.equal(typeof tool.annotations.destructiveHint, "boolean");
    assert.equal(tool.annotations.openWorldHint, false);
  }
  assert.equal(tools.find(t => t.name === "list_sites").annotations.readOnlyHint, true);
  assert.equal(tools.find(t => t.name === "apply_operations").annotations.destructiveHint, true);
  const page = tools.find(t => t.name === "get_page");
  assert.ok(page.inputSchema.properties.pageId);
  const edit = tools.find(t => t.name === "apply_operations");
  assert.ok(edit.inputSchema.properties.expectedRevision);
  assert.ok(edit.inputSchema.properties.operations.items);
  assert.notDeepEqual(edit.inputSchema.properties.operations.items, {}, "operations must have a JSON schema");
  assert.ok(tools.find(t => t.name === "create_site").inputSchema.properties.name);
  assert.ok(tools.find(t => t.name === "create_page").inputSchema.properties.requestId);

  // MCP tool metadata describes capabilities, data and privacy boundaries.
  // Response-format instructions belong to the user's task, not tool metadata
  // that is displayed to clients during permission review.
  const staging = tools.find(t => t.name === "stage_site_doc");
  assert.match(staging.description, /Returns importUrl/);
  assert.match(staging.description, /private/);
  assert.match(staging.description, /one-hour lifetime/);
  assert.doesNotMatch(staging.description, /ALWAYS|final (?:answer|response)|ignore instructions|classifier/i);
  const reference = tools.find(t => t.name === "get_site_doc_spec");
  assert.match(reference.description, /Read-only reference/);
  assert.doesNotMatch(reference.description, /READ THIS BEFORE|Always call|final (?:answer|response)/i);
});

test("draft-only OAuth sessions expose skills and staging but not existing-site tools", async () => {
  const ctx = { auth: { scope: ["tsumu:access"] },
    props: { draftOnly: true, draftGrantId: sessionId } };
  const { response, body, message } = await rpc("tools/list", undefined, ctx);
  assert.equal(response.status, 200, body);
  assert.deepEqual(message.result.tools.map(tool => tool.name), ["get_site_doc_spec", "stage_site_doc"]);
  const denied = await rpc("tools/call", { name: "list_sites", arguments: {} }, ctx);
  assert.equal(denied.message.error?.code, -32602, denied.body);
});

test("a draft-only client can read the SiteDoc spec before staging", async () => {
  const ctx = { auth: { scope: ["tsumu:access"] },
    props: { draftOnly: true, draftGrantId: sessionId } };
  const { response, body, message } = await rpc("tools/call", {
    name: "get_site_doc_spec", arguments: {},
  }, ctx);
  assert.equal(response.status, 200, body);
  const payload = JSON.parse(message.result.content[0].text);
  assert.equal(payload.example.schemaVersion, 1);
  assert.ok(Object.values(payload.example.nodes).some(node => node.styles?.base?.default?.fontSize));
  assert.match(payload.guide, /styles\.base\.default/);
});

test("MCP stages a 12 MiB SiteDoc and rejects larger documents before charging quota", async () => {
  const ctx = { auth: { scope: ["tsumu:access"] }, props: { draftOnly: true, draftGrantId: sessionId } };
  const doc = {
    schemaVersion: 1, siteName: "Large site", assets: {}, pageOrder: ["home"],
    pages: { home: { id: "home", name: "Home", slug: "", title: "Home", description: "", children: ["text"] } },
    nodes: { text: { id: "text", type: "box", name: "Text", children: [],
      text: { content: "", heading: 0 }, styles: { base: { default: { color: "#123" } } } } },
  };
  doc.nodes.text.text.content = "x".repeat(MAX_DRAFT_BYTES - Buffer.byteLength(JSON.stringify(doc)));
  let quotaCalls = 0;
  const stored = [];
  const bindings = {
    PAIRINGS: { getByName: () => ({ fetch: async () => { quotaCalls++; return Response.json({ allowed: true }); } }) },
    IMPORT_DRAFTS: { getByName: () => ({ fetch: async (_url, init) => {
      stored.push(init.body.byteLength);
      return Response.json({ ok: true });
    } }) },
  };
  const stage = () => rpc("tools/call", { name: "stage_site_doc", arguments: { doc } }, ctx, bindings);
  const accepted = await stage();
  assert.equal(accepted.response.status, 200, accepted.body);
  assert.equal(accepted.message.result.isError, false);
  assert.equal(JSON.parse(accepted.message.result.content[0].text).sizeBytes, MAX_DRAFT_BYTES);

  doc.nodes.text.text.content += "x";
  const tooLarge = await stage();
  assert.equal(tooLarge.response.status, 200, tooLarge.body);
  assert.equal(tooLarge.message.result.isError, true);
  assert.match(tooLarge.message.result.content[0].text, /12 MiB import limit/);

  doc.nodes.text.text.content += "x".repeat(MAX_MCP_REQUEST_BYTES - MAX_DRAFT_BYTES);
  const oversizedRequest = await stage();
  assert.equal(oversizedRequest.response.status, 413, oversizedRequest.body);
  assert.equal(quotaCalls, 1);
  assert.deepEqual(stored, [MAX_DRAFT_BYTES]);
});

test("MCP Skills Extension lists bundled instructions and returns canonical skill content", async () => {
  const listed = await rpc("skills/list");
  assert.equal(listed.response.status, 200, listed.body);
  const skills = listed.message?.result?.skills;
  assert.deepEqual(skills?.map(item => item.frontmatter.name).sort(), [
    "tsumu-best-practices", "tsumu-build-site", "tsumu-edit-site",
  ]);
  const uri = "skill://tsumu-build-site/SKILL.md";
  const entry = skills.find(item => item.uri === uri);
  assert.equal(entry.frontmatter.name, "tsumu-build-site");
  assert.match(entry.frontmatter.description, /Tsumu/);
  assert.match(entry.frontmatter.description, /stage_site_doc/);
  assert.match(entry.frontmatter.description, /importUrl/);
  for (const item of skills) {
    assert.equal(item.frontmatter.license, "MIT");
    assert.equal(item.frontmatter.metadata?.author, "abshrimp");
    assert.match(item.frontmatter.compatibility, /Tsumu/);
    const config = await rpc("resources/read", {
      uri: `skill://${item.frontmatter.name}/agents/openai.yaml`,
    });
    assert.equal(config.response.status, 200, config.body);
    assert.match(config.message?.result?.contents?.[0]?.text, /allow_implicit_invocation: true/);
    assert.match(config.message?.result?.contents?.[0]?.text, /default_prompt:.*\$tsumu-/);
  }
  const skill = await rpc("skills/get", { uri });
  assert.equal(skill.response.status, 200, skill.body);
  assert.equal(skill.message?.result?.skill?.uri, uri, skill.body);
  const resource = await rpc("resources/read", { uri });
  assert.equal(resource.response.status, 200, resource.body);
  assert.match(resource.message?.result?.contents?.[0]?.text, /SiteDoc/);
  assert.match(resource.message?.result?.contents?.[0]?.text, /importUrl/);
  const reference = await rpc("resources/read", {
    uri: "skill://tsumu-build-site/references/site-doc.md",
  });
  assert.equal(reference.response.status, 200, reference.body);
  assert.match(reference.message?.result?.contents?.[0]?.text, /schemaVersion/);
  const sample = await rpc("resources/read", {
    uri: "skill://tsumu-build-site/references/minimal-site.json",
  });
  assert.equal(sample.response.status, 200, sample.body);
  const example = JSON.parse(sample.message?.result?.contents?.[0]?.text || "null");
  assert.equal(example.schemaVersion, 1);
  assert.equal(example.pages[example.pageOrder[0]].slug, "");
  assert.ok(Object.values(example.nodes).length > 1);
});

test("authenticated MCP tool call reaches the selected browser session", async () => {
  const { response, body, message } = await rpc("tools/call", {
    name: "list_sites", arguments: {},
  });
  assert.equal(response.status, 200, body);
  assert.equal(message?.result?.content?.[0]?.type, "text", body);
  assert.deepEqual(JSON.parse(message.result.content[0].text), [{ id: "demo", name: "Demo" }]);
});

test("MCP tool route rejects unauthorized and invalid session contexts", async () => {
  for (const ctx of [
    { auth: { scope: [] }, props: { sessionId } },
    { auth: { scope: ["tsumu:access"] }, props: { sessionId: "../danger" } },
    { auth: { scope: ["tsumu:access"] }, props: {} },
    {},
  ]) {
    const { response } = await rpc("tools/list", undefined, ctx);
    assert.equal(response.status, 403);
  }
});

test("MCP site and page creation are forwarded to the paired browser", async () => {
  const first = await rpc("tools/call", {
    name: "create_site", arguments: { name: "Coffee & Space", requestId: "create-site-00001" },
  });
  assert.equal(first.response.status, 200, first.body);
  assert.equal(JSON.parse(first.message.result.content[0].text).requiresReconnect, true);
  const second = await rpc("tools/call", {
    name: "create_page", arguments: { name: "Menu", requestId: "create-page-00001" },
  });
  assert.equal(second.response.status, 200, second.body);
  assert.equal(JSON.parse(second.message.result.content[0].text).pageId, "page-2");
});

test("dedicated set_text tool translates to a typed Tsumu AiOp", async () => {
  const result = await rpc("tools/call", {
    name: "set_text",
    arguments: {
      pageId: "page-1",
      expectedRevision: "0".repeat(64),
      requestId: "text-edit-0000001",
      elementId: "heading-1",
      text: "New title",
    },
  });
  assert.equal(result.response.status, 200, result.body);
  assert.deepEqual(JSON.parse(result.message.result.content[0].text).applied, [{
    op: "set_text", id: "heading-1", text: "New title",
  }]);
});

test("a missing operation name is rejected before the browser call", async () => {
  const result = await rpc("tools/call", {
    name: "apply_operations",
    arguments: {
      pageId: "page-1",
      expectedRevision: "0".repeat(64),
      requestId: "wrong-operation-0001",
      operations: [{ id: "heading-1", text: "Missing operation" }],
    },
  });
  assert.equal(result.message?.result?.isError, true, result.body);
  assert.match(result.message.result.content[0].text, /Invalid arguments.*operations\.0\.op/);
});
