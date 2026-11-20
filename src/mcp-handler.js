import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "./mcp.js";
import { MAX_MCP_REQUEST_BYTES } from "./draft-limits.js";

/**
 * OAuthProvider verifies the bearer token and attaches its session-specific
 * authorization props to ctx. The HTTP handler accepts a full-sized draft
 * together with its JSON-RPC envelope within a bounded request body.
 */
export async function serveAuthenticatedMcp(request, env, ctx) {
  const draftOnly = ctx.props?.draftOnly === true;
  const grantId = draftOnly ? ctx.props?.draftGrantId : ctx.props?.grantId;
  if (!ctx.auth?.scope?.includes("tsumu:access") || typeof grantId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(grantId)) {
    return new Response("Forbidden", { status: 403 });
  }
  const handler = createMcpHandler(() => createServer(env, grantId, { draftOnly }), {
    maxRequestBodySize: MAX_MCP_REQUEST_BYTES,
  });
  return handler.fetch(request);
}
