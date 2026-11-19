import { DurableObject } from "cloudflare:workers";

const TTL_MS = 10 * 60_000;
const ATTEMPT_WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 20;

export class PairingRegistry extends DurableObject {
  async fetch(request) {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const url = new URL(request.url);
    const data = await request.json();
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
        return { sessionId: entry.sessionId, status: 200 };
      });
      await this.scheduleCleanup();
      if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ sessionId: result.sessionId });
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
      if (!/^(code:|rate:|create:)/.test(key)) continue;
      if (entry?.expiresAt <= Date.now()) await this.ctx.storage.delete(key);
      else if (entry?.expiresAt) next = Math.min(next, entry.expiresAt);
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
  }
}
