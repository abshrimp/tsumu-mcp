export const MAX_DRAFT_BYTES = 12 * 1024 * 1024;

// A full-sized SiteDoc also needs space for the JSON-RPC envelope and whitespace.
export const MAX_MCP_REQUEST_BYTES = MAX_DRAFT_BYTES + 1024 * 1024;
