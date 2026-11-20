import { DurableObject } from "cloudflare:workers";
import { siteGrantsRequest } from "./site-grants.js";

const TTL_MS = 10 * 60_000;
const ATTEMPT_WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 20;

export class PairingRegistry extends DurableObject {
  async fetch(request) {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const url = new URL(request.url);
    const data = await request.json();
    if (url.pathname.startsWith("/grant/")) {
      const response = await siteGrantsRequest(this.ctx.storage, url.pathname, data);
      if (response.ok) await this.scheduleCleanup();
      return response;
    }
    if (url.pathname === "/quota") {
      const { requester } = data;
      if (!/^[a-f0-9]{64}$/.test(requester)) return Response.json({ error: "Invalid quota key" }, { status: 400 });
      const allowed = await this.ctx.storage.transaction(async txn => {
        const key = "create:" + requester;
        const now = Date.now();
        const old = await txn.get(key);
        const count = old?.expiresAt > now ? old.count : 0;
        const requestedLimit = data.limit === 3 ? 3 : 12;
        if (count >= requestedLimit) return false;
        await txn.put(key, { count: count + 1, expiresAt: now + 10 * 60_000 });
        return true;
      });
      await this.scheduleCleanup();
      return Response.json({ allowed }, { status: allowed ? 200 : 429 });
    }
    if (url.pathname === "/put") {
      const { hash, sessionId } = data;
      if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9-]{36}$/.test(sessionId)) {
        return Response.json({ error: "Invalid pairing" }, { status: 400 });
      }
      await this.ctx.storage.put("code:" + hash, { sessionId, expiresAt: Date.now() + TTL_MS });
      await this.scheduleCleanup();
      return Response.json({ ok: true });
    }
    if (url.pathname === "/take") {
      const { hash, requester } = data;
      if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9]{64}$/.test(requester)) {
        return Response.json({ error: "Invalid pairing" }, { status: 400 });
      }
      const result = await this.ctx.storage.transaction(async (txn) => {
        const now = Date.now();
        const rateKey = "rate:" + requester;
        const rate = await txn.get(rateKey);
        const count = rate && rate.expiresAt > now ? rate.count : 0;
        if (count >= MAX_ATTEMPTS) return { error: "Too many attempts", status: 429 };
        await txn.put(rateKey, { count: count + 1, expiresAt: now + ATTEMPT_WINDOW_MS });
        const key = "code:" + hash;
        const entry = await txn.get(key);
        if (!entry || entry.expiresAt <= now) return { error: "Invalid or expired code", status: 400 };
        await txn.delete(key);
        return { sessionId: entry.sessionId, expiresAt: entry.expiresAt, status: 200 };
      });
      await this.scheduleCleanup();
      if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ sessionId: result.sessionId, expiresAt: result.expiresAt });
    }
    if (url.pathname === "/restore") {
      // A consumed code can be restored only when claiming its browser fails.
      // Keep its original expiry: a retry must never extend the 10-minute window.
      const { hash, sessionId, expiresAt } = data;
      const now = Date.now();
      if (!/^[a-f0-9]{64}$/.test(hash) || !/^[0-9a-f-]{36}$/.test(sessionId) ||
          !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + TTL_MS) {
        return Response.json({ error: "Invalid pairing" }, { status: 400 });
      }
      const restored = await this.ctx.storage.transaction(async txn => {
        const key = "code:" + hash;
        const existing = await txn.get(key);
        if (existing && existing.expiresAt > Date.now()) return false;
        await txn.put(key, { sessionId, expiresAt });
        return true;
      });
      await this.scheduleCleanup();
      return Response.json({ restored }, { status: restored ? 200 : 409 });
    }
    return new Response(null, { status: 404 });
  }

  async scheduleCleanup() {
    if (await this.ctx.storage.getAlarm() === null) {
      await this.ctx.storage.setAlarm(Date.now() + 10 * 60_000);
    }
  }

  async alarm() {
    const entries = await this.ctx.storage.list();
    let next = Infinity;
    for (const [key, entry] of entries) {
      if (!/^(code:|rate:|create:|grant:|invite:)/.test(key)) continue;
      if (entry?.expiresAt <= Date.now()) await this.ctx.storage.delete(key);
      else if (entry?.expiresAt) next = Math.min(next, entry.expiresAt);
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
  }
}
