import { sha256 } from "./pair-code.js";

export const RECONNECT_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const ACTIVE_SESSION_MS = 60 * 60 * 1000;
const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const SITE_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function randomBridgeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function nameFor(origin, siteId) {
  if (!SITE_RE.test(siteId)) throw new Error("Invalid site ID");
  return "__Host-tsumu_mcp_" + (await sha256(origin)).slice(0, 32) + "_" + siteId;
}

export async function reconnectCookie(origin, siteId, sessionId, secret) {
  if (!SESSION_RE.test(sessionId) || !TOKEN_RE.test(secret)) throw new Error("Invalid reconnect credential");
  return (await nameFor(origin, siteId)) + "=" + sessionId + "." + secret +
    "; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=None";
}

export async function clearReconnectCookie(origin, siteId) {
  return (await nameFor(origin, siteId)) + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None";
}

/** Cookie stays host-only and inaccessible to scripts; one grant per editor origin/site. */
export async function readReconnectCookie(request, origin, siteId) {
  if (!SITE_RE.test(siteId)) return null;
  const name = await nameFor(origin, siteId);
  const cookies = (request.headers.get("Cookie") || "").split(";").map(value => value.trim());
  const entry = cookies.find(value => value.startsWith(name + "="));
  if (!entry) return null;
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(entry.slice(name.length + 1));
  if (!match || !SESSION_RE.test(match[1])) return null;
  return { sessionId: match[1], secret: match[2] };
}
