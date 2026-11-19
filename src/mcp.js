import { McpServer } from "@modelcontextprotocol/server";
import { SkillsExtension, memorySkillFiles } from "@modelcontextprotocol/server/ext/skills";
import { skillFiles } from "./generated-skills.js";
import { stageSiteDoc } from "./drafts.js";
import { z } from "zod";
import { aiOperation, aiNode, styles, editContext, requestId } from "./schemas.js";

const skillCatalog = await SkillsExtension.load(memorySkillFiles(skillFiles), { strict: true });

function textResult(value, isError = false) {
  return { isError, content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] };
}

async function execute(env, sessionId, action, args = {}) {
  const room = env.BROWSER_SESSIONS.getByName(sessionId);
  const response = await room.fetch("https://internal/call", {
    method: "POST",
    body: JSON.stringify({ action, args }),
  });
  let body;
  try { body = await response.json(); } catch { throw new Error("Invalid bridge response"); }
  if (!response.ok) throw new Error(body.error || "Tsumu bridge unavailable");
  return body.result;
}

export function createServer(env, sessionId, { draftOnly = false } = {}) {
  const server = new McpServer({ name: "tsumu", version: "0.1.0" });
  skillCatalog.attach(server);
  const tool = (name, title, description, inputSchema, action, transform = args => args) => {
    // Safety metadata is used by AI clients and public-directory review.
    const readOnlyHint = ["list_sites", "list_pages", "get_page", "get_element"].includes(name);
    const destructiveHint = ["apply_operations", "set_text", "set_style"].includes(name);
    const annotations = { title, readOnlyHint, destructiveHint, openWorldHint: false };
    server.registerTool(name, { description, inputSchema, annotations }, async (args) => {
      try { return textResult(await execute(env, sessionId, action, transform(args))); }
      catch (error) { return textResult(error instanceof Error ? error.message : "Operation failed", true); }
    });
  };

  if (!draftOnly) {
  tool("list_sites", "List authorized sites",
    "List the one site currently authorized in this browser pairing. A newly created site requires opening its returned URL and pairing again.",
    z.object({}), "list_sites");
  tool("list_pages", "List pages", "List pages and IDs of the currently paired site.",
    z.object({}), "list_pages");
  tool("get_page", "Get page",
    "Fetch a page's editable document, element IDs, and revision. Use the revision for editing; fetch again after a conflict.",
    z.object({ pageId: z.string().min(1).max(100) }), "get_page");
  tool("get_element", "Get element", "Read one element's text, styles, and children by ID.",
    z.object({ elementId: z.string().min(1).max(100) }), "get_element");

  tool("create_site", "Create site",
    "Create a NEW browser-stored Tsumu site, without overwriting the currently paired site. Available only on browser-only Tsumu instances, not server storage. Returns a new site URL. To edit that new site, open its URL in this same browser and authorize a NEW MCP pairing. requestId must be unique for each creation and stable for retries.",
    z.strictObject({ name: z.string().trim().min(1).max(100), requestId }),
    "create_site");
  tool("create_page", "Create page",
    "Create a named page in the currently paired Tsumu site and return its generated pageId and slug. Saving is verified. Does not require a revision, but do not reuse requestId for a different create.",
    z.strictObject({ name: z.string().trim().min(1).max(100), requestId }),
    "create_page");

  tool("apply_operations", "Apply page edits",
    "Apply 1-100 Tsumu AiOp edits to one page in a single undoable step. Each operation requires an 'op' field such as 'insert', 'set_text', or 'set_style'. Use get_page first to obtain pageId, element IDs, and expectedRevision. On a conflict, fetch again. requestId is a unique idempotency key; do not blindly retry timeouts.",
    z.strictObject({ ...editContext, operations: z.array(aiOperation).min(1).max(100) }),
    "apply_operations");

  tool("set_text", "Set element text",
    "Change an existing element's text. Prefer this over manually constructing an AiOp. First call get_page to obtain element ID and revision.",
    z.strictObject({ ...editContext, elementId: z.string().min(1).max(100), text: z.string().max(200000), level: z.number().int().min(0).max(6).optional() }),
    "apply_operations",
    ({ elementId, text, level, ...args }) => ({
      ...args, operations: [{ op: "set_text", id: elementId, text, ...(level === undefined ? {} : { level }) }],
    }));
  tool("set_style", "Set element styles",
    "Update CSS properties on an existing element. First call get_page to obtain element ID and revision.",
    z.strictObject({ ...editContext, elementId: z.string().min(1).max(100), styles, breakpoint: z.string().max(100).optional(), state: z.enum(["default", "hover", "active", "focus"]).optional() }),
    "apply_operations",
    ({ elementId, styles, breakpoint, state, ...args }) => ({
      ...args, operations: [{ op: "set_style", id: elementId, styles, ...(breakpoint ? { breakpoint } : {}), ...(state ? { state } : {}) }],
    }));
  tool("insert_element", "Insert element",
    "Add a new Tsumu element (including optional nested children) to a page. Use parent='page' for page root. First call get_page for revision. Use a 'type' such as box, text, heading, image, or button in the node spec.",
    z.strictObject({ ...editContext, node: aiNode, parent: z.string().min(1).max(100).optional(), index: z.number().int().min(0).max(100000).optional(), before: z.string().max(100).optional(), after: z.string().max(100).optional() }),
    "apply_operations",
    ({ node, parent, index, before, after, ...args }) => ({
      ...args, operations: [{
        op: "insert", node, ...(parent ? { parent } : {}), ...(index !== undefined ? { index } : {}),
        ...(before ? { before } : {}), ...(after ? { after } : {}),
      }],
    }));
  }
  server.registerTool("get_site_doc_spec", {
    description: "Read-only reference for creating editable Tsumu SiteDoc documents. Returns an authoring guide and a valid styled example with native node types and responsive style shapes. Suitable for consulting before generating a new site.",
    inputSchema: z.strictObject({}),
    annotations: { title: "Get SiteDoc specification", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => textResult({
    guide: skillFiles["tsumu-build-site/references/site-doc.md"],
    example: JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]),
  }));
  server.registerTool("stage_site_doc", {
    description: "Temporarily store a complete editable SiteDoc for importing as a separate NEW Tsumu site. Returns importUrl, expiresAt, sizeBytes, and siteName. The importUrl is a private, expiring one-time link to open in Tsumu; it contains a bearer secret in its URL fragment. Opening it imports the document, and Tsumu confirms deletion only after saving the new site. This does not edit the currently paired site or publish a site. Input uses schemaVersion 1 with pages, pageOrder, nodes, assets, and styles.base.default for native CSS. The get_site_doc_spec tool provides the current authoring guide and example. Maximum 12 MiB; one-hour lifetime.",
    inputSchema: z.strictObject({
      doc: z.record(z.string(), z.unknown()),
      editorOrigin: z.string().optional().describe("Optional Tsumu self-host origin, e.g. https://tsumu.example.org. Defaults to https://tsumu.ebii.net"),
    }),
    annotations: { title: "Stage new site document", readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ doc, editorOrigin }) => {
    try { return textResult(await stageSiteDoc(env, sessionId, doc, editorOrigin)); }
    catch (error) { return textResult(error instanceof Error ? error.message : "Unable to stage site", true); }
  });
  return server;
}
