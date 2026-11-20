import { sha256 } from "./pair-code.js";
import { randomBridgeToken, RECONNECT_IDLE_MS } from "./bridge-cookie.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SITE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const TICKET_TTL_MS = 10 * 60_000;
const noStore = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function siteGrantsRequest(storage, path, input) {
  const id = input?.grantId;
  const key = "grant:" + id;
  if (!UUID.test(id || "")) return noStore({ error: "Invalid grant" }, 400);
  const now = Date.now();

  if (path === "/grant/create") {
    if (!Array.isArray(input.sites) || input.sites.length < 1 || input.sites.length > 12 ||
        input.sites.some(s => !s || !UUID.test(s.sessionId) || !SITE_ID.test(s.siteId) ||
          typeof s.siteName !== "string" || s.siteName.length > 120 || typeof s.canEdit !== "boolean") ||
        new Set(input.sites.map(s => s.siteId)).size !== input.sites.length) {
      return noStore({ error: "Invalid authorized sites" }, 400);
    }
    const grant = { sites: input.sites, activeSiteId: input.sites[0].siteId, expiresAt: now + RECONNECT_IDLE_MS };
    const created = await storage.transaction(async txn => {
      if (await txn.get(key)) return false;
      await txn.put(key, grant);
      return true;
    });
    return noStore({ created }, created ? 200 : 409);
  }

  const grant = await storage.get(key);
  if (!grant || grant.expiresAt <= now) return noStore({ error: "Grant expired" }, 410);
  if (path === "/grant/resolve") {
    const site = grant.sites.find(s => s.siteId === grant.activeSiteId);
    return site ? noStore({ ...site, activeSiteId: grant.activeSiteId }) :
      noStore({ error: "Selected site unavailable" }, 410);
  }
  if (path === "/grant/list") {
    return noStore({ sites: grant.sites, activeSiteId: grant.activeSiteId });
  }
  if (path === "/grant/select") {
    if (!SITE_ID.test(input.siteId || "") || !grant.sites.some(s => s.siteId === input.siteId)) {
      return noStore({ error: "Site not authorized" }, 403);
    }
    grant.activeSiteId = input.siteId;
    await storage.put(key, grant);
    return noStore({ activeSiteId: grant.activeSiteId });
  }
  if (path === "/grant/inspect") {
    if (typeof input.ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.ticket)) {
      return noStore({ error: "Invalid invitation" }, 400);
    }
    const entry = await storage.get("invite:" + await sha256(input.ticket));
    return entry?.grantId === id && entry.expiresAt > now
      ? noStore({ valid: true }) : noStore({ error: "Invitation expired" }, 410);
  }
  if (path === "/grant/invite") {
    const ticket = randomBridgeToken();
    await storage.put("invite:" + await sha256(ticket), {
      grantId: id, expiresAt: now + TICKET_TTL_MS,
    });
    return noStore({ ticket, expiresAt: now + TICKET_TTL_MS });
  }
  if (path === "/grant/add") {
    if (typeof input.ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.ticket) ||
        !UUID.test(input.site?.sessionId || "") || !SITE_ID.test(input.site?.siteId || "") ||
        typeof input.site?.siteName !== "string" || typeof input.site?.canEdit !== "boolean") {
      return noStore({ error: "Invalid invitation" }, 400);
    }
    const ticketKey = "invite:" + await sha256(input.ticket);
    return storage.transaction(async txn => {
      const ticket = await txn.get(ticketKey);
      if (!ticket || ticket.grantId !== id || ticket.expiresAt <= Date.now()) {
        return noStore({ error: "Invitation expired" }, 410);
      }
      const current = await txn.get(key);
      if (!current || current.expiresAt <= Date.now()) return noStore({ error: "Grant expired" }, 410);
      await txn.delete(ticketKey);
      const sites = current.sites.filter(s => s.siteId !== input.site.siteId);
      if (sites.length >= 12) return noStore({ error: "Too many authorized sites" }, 400);
      current.sites = [...sites, input.site];
      current.activeSiteId = input.site.siteId;
      current.expiresAt = Date.now() + RECONNECT_IDLE_MS;
      await txn.put(key, current);
      return noStore({ siteId: input.site.siteId, activeSiteId: current.activeSiteId });
    });
  }
  return noStore({ error: "Not found" }, 404);
}
