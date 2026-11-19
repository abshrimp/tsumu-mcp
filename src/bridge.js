import { readLimitedText } from "./request-body.js";
import { pairingCode, sha256 } from "./pair-code.js";
import { allowedBrowserOrigin } from "./origin.js";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BODY = 2048;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function bad(error, status, origin) {
  return Response.json({ error }, { status, headers: origin ? cors(origin) : { "Cache-Control": "no-store" } });
}

export async function bridgeRequest(request, env) {
  const url = new URL(request.url);
  const origin = allowedBrowserOrigin(request.headers.get("Origin"));
  if (!origin) return bad("Origin not allowed", 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (url.pathname === "/bridge/connect") {
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return bad("WebSocket required", 426, origin);
    }
    const sessionId = url.searchParams.get("session");
    if (!sessionId || !SESSION_ID.test(sessionId)) return bad("Invalid session", 400, origin);
    return env.BROWSER_SESSIONS.getByName(sessionId).fetch(new Request("https://internal/ws", request));
  }
  if (request.method !== "POST") {
    const response = bad("POST required", 405, origin);
    response.headers.set("Allow", "POST, OPTIONS");
    return response;
  }
  const mediaType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") return bad("Expected application/json", 415, origin);
  const raw = await readLimitedText(request, MAX_BODY);
  if (raw === null) return bad("Request too large", 413, origin);
  let input;
  try { input = JSON.parse(raw); } catch { return bad("Invalid JSON", 400, origin); }
  if (url.pathname === "/bridge/sessions") {
    const siteId = input?.siteId;
    const siteName = input?.siteName;
    if (typeof siteId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(siteId) ||
        typeof siteName !== "string" || siteName.length > 120 || !siteName.trim() ||
        typeof input.canEdit !== "boolean") {
      return bad("Invalid site", 400, origin);
    }
    const registry = env.PAIRINGS.getByName("global");
    const quota = await registry.fetch("https://internal/quota", {
      method: "POST", body: JSON.stringify({ requester: await sha256(request.headers.get("CF-Connecting-IP") || "unknown") }),
    });
    if (!quota.ok) return bad("Too many pairing requests", 429, origin);
    const sessionId = crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const connectToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const code = pairingCode();
    const room = env.BROWSER_SESSIONS.getByName(sessionId);
    const initialized = await room.fetch("https://internal/init", {
      method: "POST",
      body: JSON.stringify({ siteId, siteName, canEdit: input.canEdit, secretHash: await sha256(connectToken) }),
    });
    if (!initialized.ok) return bad("Unable to start session", 503, origin);
    const { expiresAt } = await initialized.json();
    const registered = await registry.fetch("https://internal/put", {
      method: "POST", body: JSON.stringify({ hash: await sha256(code.replaceAll("-", "")), sessionId }),
    });
    if (!registered.ok) return bad("Unable to register pairing code", 503, origin);
    const wsUrl = new URL(request.url);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.pathname = "/bridge/connect";
    wsUrl.search = "?session=" + encodeURIComponent(sessionId);
    return Response.json({
      sessionId,
      pairingCode: code,
      connectToken,
      wsUrl: wsUrl.toString(),
      mcpUrl: new URL("/mcp", request.url).toString(),
      expiresAt,
    }, { headers: cors(origin) });
  }
  if (url.pathname === "/bridge/revoke") {
    if (typeof input?.sessionId !== "string" || !SESSION_ID.test(input.sessionId) || typeof input.connectToken !== "string") {
      return bad("Invalid session", 400, origin);
    }
    const result = await env.BROWSER_SESSIONS.getByName(input.sessionId).fetch("https://internal/revoke", {
      method: "POST", body: JSON.stringify({ connectToken: input.connectToken }),
    });
    return new Response(result.body, { status: result.status, headers: { ...cors(origin), "Content-Type": "application/json" } });
  }
  return bad("Not found", 404, origin);
}

export async function redeemPairing(env, code, requesterIp) {
  const hash = await sha256(code);
  const requester = await sha256(requesterIp || "unknown");
  const result = await env.PAIRINGS.getByName("global").fetch("https://internal/take", {
    method: "POST", body: JSON.stringify({ hash, requester }),
  });
  if (!result.ok) {
    if (result.status !== 400 && result.status !== 429) {
      throw new Error("Pairing service unavailable");
    }
    const data = await result.json();
    throw new Error(data.error || "Invalid or expired code");
  }
  const { sessionId, expiresAt } = await result.json();
  const room = env.BROWSER_SESSIONS.getByName(sessionId);
  const restoreCode = async () => {
    // The registry removed the code atomically before the browser claim.
    // If its tab went offline in between, allow another attempt without a new code.
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return;
    try {
      await env.PAIRINGS.getByName("global").fetch("https://internal/restore", {
        method: "POST", body: JSON.stringify({ hash, sessionId, expiresAt }),
      });
    } catch { /* The original claim failure is more useful to report. */ }
  };
  let claim;
  try {
    claim = await room.fetch("https://internal/claim", {
      method: "POST", body: "{}",
    });
  } catch (error) {
    await restoreCode();
    throw error;
  }
  if (!claim.ok) {
    await restoreCode();
    if (claim.status !== 410) throw new Error("Pairing service unavailable");
    throw new Error("The browser is not connected, or this code was already used");
  }
  return { sessionId, ...(await claim.json()) };
}
