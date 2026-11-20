import { sha256 } from "./pair-code.js";
import { randomBridgeToken, RECONNECT_IDLE_MS } from "./bridge-cookie.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SITE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const TICKET = /^[A-Za-z0-9_-]{43}$/;
const MAX_SITES = 12;
const TICKET_TTL_MS = 10 * 60_000;
const noStore = (value, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

const expiredGrant = () => noStore({ error: "Grant expired" }, 410);

/**
 * Grant IDs belong to OAuth clients. Each authorized site is keyed by its
 * session reference, not its human-readable site ID: two independent Tsumu
 * instances may legitimately use the same site ID.
 */
export async function siteGrantsRequest(storage, path, input) {
  const id = input?.grantId;
  if (typeof id !== "string" || !UUID.test(id)) return noStore({ error: "Invalid grant" }, 400);
  const key = "grant:" + id;
  const now = Date.now();

  if (path === "/grant/create") {
    if (!Array.isArray(input.sites) || input.sites.length < 1 || input.sites.length > MAX_SITES ||
        input.sites.some(s => !s || !UUID.test(s.sessionId) || !SITE_ID.test(s.siteId) ||
          typeof s.siteName !== "string" || s.siteName.length > 120 || typeof s.canEdit !== "boolean") ||
        new Set(input.sites.map(s => s.sessionId)).size !== input.sites.length) {
      return noStore({ error: "Invalid authorized sites" }, 400);
    }
    const created = await storage.transaction(async txn => {
      if (await txn.get(key)) return false;
      await txn.put(key, {
        sites: input.sites, activeSessionId: input.sites[0].sessionId,
        expiresAt: now + RECONNECT_IDLE_MS,
      });
      return true;
    });
    return noStore({ created }, created ? 200 : 409);
  }

  // The OAuth grant has a sliding seven-day idle timeout, separate from each
  // browser bridge's short-lived session. Only authenticated MCP operations
  // (not a third-party invitation inspection) refresh this grant.
  if (path === "/grant/list" || path === "/grant/resolve" || path === "/grant/select") {
    return storage.transaction(async txn => {
      const grant = await txn.get(key);
      if (!grant || grant.expiresAt <= Date.now()) return expiredGrant();
      const active = grant.sites.find(s => s.sessionId === grant.activeSessionId);
      if (path === "/grant/resolve") {
        if (!active) return noStore({ error: "Selected site unavailable" }, 410);
        grant.expiresAt = Date.now() + RECONNECT_IDLE_MS;
        await txn.put(key, grant);
        return noStore({ ...active, activeSiteId: active.siteId, activeSiteRef: active.sessionId });
      }
      if (path === "/grant/list") {
        grant.expiresAt = Date.now() + RECONNECT_IDLE_MS;
        await txn.put(key, grant);
        return noStore({
          sites: grant.sites, activeSiteId: active?.siteId ?? null,
          activeSiteRef: active?.sessionId ?? null,
        });
      }
      const requestedRef = input.siteRef;
      const requestedId = input.siteId;
      if (requestedRef !== undefined && (typeof requestedRef !== "string" || !UUID.test(requestedRef))) {
        return noStore({ error: "Invalid site reference" }, 400);
      }
      if (requestedId !== undefined && (typeof requestedId !== "string" || !SITE_ID.test(requestedId))) {
        return noStore({ error: "Invalid site ID" }, 400);
      }
      if ((requestedId === undefined) === (requestedRef === undefined)) {
        return noStore({ error: "Choose exactly one of siteId or siteRef" }, 400);
      }
      const matches = grant.sites.filter(s =>
        requestedRef !== undefined ? s.sessionId === requestedRef : s.siteId === requestedId
      );
      if (matches.length === 0) return noStore({ error: "Site not authorized" }, 403);
      if (matches.length > 1) return noStore({
        error: "Site ID is ambiguous; choose a siteRef returned by list_sites",
      }, 409);
      grant.activeSessionId = matches[0].sessionId;
      grant.expiresAt = Date.now() + RECONNECT_IDLE_MS;
      await txn.put(key, grant);
      return noStore({ activeSiteId: matches[0].siteId, activeSiteRef: matches[0].sessionId });
    });
  }

  const grant = await storage.get(key);
  if (!grant || grant.expiresAt <= now) return expiredGrant();

  if (path === "/grant/inspect") {
    if (typeof input.ticket !== "string" || !TICKET.test(input.ticket)) {
      return noStore({ error: "Invalid invitation" }, 400);
    }
    const hash = await sha256(input.ticket);
    if (grant.pendingInviteHash !== hash) return noStore({ error: "Invitation expired" }, 410);
    const entry = await storage.get("invite:" + hash);
    return entry?.grantId === id && entry.expiresAt > Date.now()
      ? noStore({ valid: true }) : noStore({ error: "Invitation expired" }, 410);
  }

  if (path === "/grant/invite") {
    const ticket = randomBridgeToken();
    const hash = await sha256(ticket);
    const response = await storage.transaction(async txn => {
      const current = await txn.get(key);
      if (!current || current.expiresAt <= Date.now()) return expiredGrant();
      // Only the latest invitation is valid, preventing unbounded one-use
      // ticket storage and invalidating abandoned approval links.
      if (current.pendingInviteHash) await txn.delete("invite:" + current.pendingInviteHash);
      const expiresAt = Date.now() + TICKET_TTL_MS;
      await txn.put("invite:" + hash, { grantId: id, expiresAt });
      current.pendingInviteHash = hash;
      current.expiresAt = Date.now() + RECONNECT_IDLE_MS;
      await txn.put(key, current);
      return noStore({ ticket, expiresAt });
    });
    return response;
  }

  if (path === "/grant/add") {
    if (typeof input.ticket !== "string" || !TICKET.test(input.ticket) ||
        !UUID.test(input.site?.sessionId || "") || !SITE_ID.test(input.site?.siteId || "") ||
        typeof input.site?.siteName !== "string" || input.site.siteName.length > 120 ||
        typeof input.site?.canEdit !== "boolean") {
      return noStore({ error: "Invalid invitation" }, 400);
    }
    const ticketHash = await sha256(input.ticket);
    return storage.transaction(async txn => {
      const current = await txn.get(key);
      if (!current || current.expiresAt <= Date.now()) return expiredGrant();
      if (current.pendingInviteHash !== ticketHash) return noStore({ error: "Invitation expired" }, 410);
      const ticketKey = "invite:" + ticketHash;
      const invitation = await txn.get(ticketKey);
      if (!invitation || invitation.grantId !== id || invitation.expiresAt <= Date.now()) {
        return noStore({ error: "Invitation expired" }, 410);
      }
      const sites = current.sites.filter(s => s.sessionId !== input.site.sessionId);
      if (sites.length >= MAX_SITES) {
        // A failed addition must not consume an otherwise valid invitation.
        return noStore({ error: "Too many authorized sites" }, 400);
      }
      await txn.delete(ticketKey);
      delete current.pendingInviteHash;
      current.sites = [...sites, input.site];
      current.activeSessionId = input.site.sessionId;
      current.expiresAt = Date.now() + RECONNECT_IDLE_MS;
      await txn.put(key, current);
      return noStore({
        siteId: input.site.siteId, siteRef: input.site.sessionId,
        activeSiteId: input.site.siteId, activeSiteRef: input.site.sessionId,
      });
    });
  }
  return noStore({ error: "Not found" }, 404);
}
