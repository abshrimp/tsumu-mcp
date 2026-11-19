import { sha256 } from "./pair-code.js";
import { canCompleteDraft } from "./draft-lease.js";
import { readLimitedText } from "./request-body.js";
import { MAX_DRAFT_BYTES } from "./draft-limits.js";
import { DurableObject } from "cloudflare:workers";

const CHUNK_BYTES = 96 * 1024;
const LEASE_MS = 5 * 60_000;
const json = (value, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store" },
});

/** One isolated, expiring Durable Object per draft; no site data is stored in KV. */
export class ImportDraft extends DurableObject {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const path = new URL(request.url).pathname;
    if (path === "/create") {
      const hash = request.headers.get("X-Draft-Hash");
      const expiresAt = Number(request.headers.get("X-Expires-At"));
      if (!/^[a-f0-9]{64}$/.test(hash || "") ||
        !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() ||
        expiresAt > Date.now() + 60 * 60_000 + 10_000) return json({ error: "Invalid draft" }, 400);
      if (await this.ctx.storage.get("meta")) return json({ error: "Draft already exists" }, 409);
      const payload = new Uint8Array(await request.arrayBuffer());
      if (!payload.length || payload.byteLength > MAX_DRAFT_BYTES) return json({ error: "Draft too large" }, 413);
      const chunks = Math.ceil(payload.length / CHUNK_BYTES);
      const meta = { hash, expiresAt, chunks, length: payload.length, ready: false, lease: null };
      await this.ctx.storage.put("meta", meta);
      await this.ctx.storage.setAlarm(expiresAt);
      for (let i = 0; i < chunks; i++) {
        await this.ctx.storage.put("chunk:" + i, payload.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
      }
      await this.ctx.storage.put("meta", { ...meta, ready: true });
      return json({ ok: true });
    }
    let input;
    try {
      const raw = await readLimitedText(request, 1024);
      if (raw === null) return json({ error: "Invalid request" }, 400);
      input = JSON.parse(raw);
    } catch { return json({ error: "Invalid request" }, 400); }
    if (typeof input.secret !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(input.secret)) {
      return json({ error: "Draft unavailable" }, 404);
    }
    const provided = await sha256(input.secret);
    if (path === "/claim") {
      const receipt = crypto.randomUUID();
      const outcome = await this.ctx.storage.transaction(async txn => {
        const meta = await txn.get("meta");
        if (!meta?.ready || meta.expiresAt <= Date.now() || meta.hash !== provided) return { status: 404 };
        if (meta.lease?.until > Date.now()) return { status: 409 };
        const lease = { hash: await sha256(receipt), until: Date.now() + LEASE_MS };
        await txn.put("meta", { ...meta, lease });
        return { status: 200, meta };
      });
      if (outcome.status !== 200) {
        return json({ error: outcome.status === 409 ? "Import already in progress; try again shortly" : "Draft expired or unavailable" }, outcome.status);
      }
      const { meta } = outcome;
      const bytes = new Uint8Array(meta.length);
      let position = 0;
      for (let i = 0; i < meta.chunks; i++) {
        const chunk = await this.ctx.storage.get("chunk:" + i);
        if (!(chunk instanceof Uint8Array) || position + chunk.length > bytes.length) {
          return json({ error: "Incomplete draft" }, 503);
        }
        bytes.set(chunk, position);
        position += chunk.length;
      }
      if (position !== bytes.length) return json({ error: "Incomplete draft" }, 503);
      return json({ doc: new TextDecoder().decode(bytes), receipt, expiresAt: meta.expiresAt });
    }
    if (path === "/complete") {
      if (typeof input.receipt !== "string") return json({ error: "Invalid receipt" }, 400);
      const meta = await this.ctx.storage.get("meta");
      if (!canCompleteDraft(meta, provided, await sha256(input.receipt))) {
        return json({ error: "Draft unavailable" }, 404);
      }
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  }

  async alarm() {
    const meta = await this.ctx.storage.get("meta");
    if (!meta || meta.expiresAt <= Date.now()) await this.ctx.storage.deleteAll();
    else await this.ctx.storage.setAlarm(meta.expiresAt);
  }
}
