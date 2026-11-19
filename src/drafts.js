import { readLimitedText } from "./request-body.js";
import { allowedBrowserOrigin } from "./origin.js";
import { sha256 } from "./pair-code.js";
import { checkStagedSiteDoc } from "./site-doc-check.js";
import { MAX_DRAFT_BYTES } from "./draft-limits.js";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DRAFT_TTL_MS = 60 * 60_000;
const DEFAULT_EDITOR = "https://tsumu.ebii.net";

function error(message, status) {
  throw new Error(message + " (" + status + ")");
}

function editorOrigin(value) {
  const url = new URL(value || DEFAULT_EDITOR);
  if (!allowedBrowserOrigin(url.origin) || url.href !== url.origin + "/" ||
      url.username || url.password) throw new Error("editorOrigin must be a plain HTTPS editor origin or a local loopback origin");
  return url.origin;
}

/** Used by OAuth-authenticated MCP calls and the credential-gated fixed review fixture. */
export async function stageSiteDoc(env, sessionId, doc, chosenEditorOrigin) {
  // Reject unsupported AI-generated node/style shapes before using draft quota.
  // Full structural and security validation is repeated by the editor on import.
  checkStagedSiteDoc(doc);
  const editor = editorOrigin(chosenEditorOrigin);
  const serialized = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(serialized);
  if (bytes.length > MAX_DRAFT_BYTES) throw new Error("SiteDoc exceeds the 12 MiB import limit");
  const registry = env.PAIRINGS.getByName("global");
  const quota = await registry.fetch("https://internal/quota", {
    method: "POST", body: JSON.stringify({ requester: await sha256("draft:" + sessionId) }),
  });
  if (!quota.ok) throw new Error("Draft creation rate limit exceeded");
  const id = crypto.randomUUID();
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = btoa(String.fromCharCode(...secretBytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const expiresAt = Date.now() + DRAFT_TTL_MS;
  const draft = env.IMPORT_DRAFTS.getByName(id);
  const result = await draft.fetch("https://internal/create", {
    method: "POST",
    headers: { "X-Draft-Hash": await sha256(secret), "X-Expires-At": String(expiresAt) },
    body: bytes,
  });
  if (!result.ok) error("Could not stage the SiteDoc", result.status);
  const url = new URL("/", editor);
  url.hash = "tsumu-import=" + id + "." + secret;
  return { importUrl: url.toString(), expiresAt, sizeBytes: bytes.length, siteName: doc.siteName };
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
  };
}

export async function importDraftRequest(request, env) {
  const origin = allowedBrowserOrigin(request.headers.get("Origin"));
  if (!origin) return Response.json({ error: "Origin not allowed" }, { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const path = new URL(request.url).pathname;
  const match = /^\/drafts\/([0-9a-f-]{36})\/(claim|complete)$/.exec(path);
  if (!match || !ID.test(match[1]) || request.method !== "POST") {
    return Response.json({ error: "Not found" }, { status: 404, headers: cors(origin) });
  }
  const bearer = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(request.headers.get("Authorization") || "");
  if (!bearer) return Response.json({ error: "Draft unavailable" }, { status: 404, headers: cors(origin) });
  let receipt;
  if (match[2] === "complete") {
    try {
      const body = await readLimitedText(request, 1024);
      if (body === null) throw new Error("too large");
      receipt = JSON.parse(body).receipt;
    } catch { return Response.json({ error: "Invalid receipt" }, { status: 400, headers: cors(origin) }); }
    if (typeof receipt !== "string" || !ID.test(receipt)) {
      return Response.json({ error: "Invalid receipt" }, { status: 400, headers: cors(origin) });
    }
  }
  const draft = env.IMPORT_DRAFTS.getByName(match[1]);
  const result = await draft.fetch("https://internal/" + match[2], {
    method: "POST", body: JSON.stringify({ secret: bearer[1], ...(receipt ? { receipt } : {}) }),
  });
  return new Response(result.body, {
    status: result.status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}
