import { readLimitedText } from "./request-body.js";
import { writeFingerprint, cachedWriteResult } from "./write-fingerprint.js";
import { DurableObject } from "cloudflare:workers";
import { sha256 } from "./pair-code.js";
import { ACTIVE_SESSION_MS, RECONNECT_IDLE_MS } from "./bridge-cookie.js";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const RESULT_TTL_MS = 10 * 60_000;

const json = (value, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export class BrowserSession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.pending = new Map();
  }

  async session() {
    return this.ctx.storage.get("session");
  }

  async scheduleCleanup(expiresAt) {
    const scheduled = await this.ctx.storage.getAlarm();
    if (scheduled === null || expiresAt < scheduled) {
      await this.ctx.storage.setAlarm(expiresAt);
    }
  }

  failSocket(socket) {
    for (const pending of this.pending.values()) {
      if (pending.socket === socket) pending.complete({ transportError: true });
    }
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/ws") return this.connect(request);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const raw = await readLimitedText(request, MAX_REQUEST_BYTES);
    if (raw === null) return json({ error: "Request too large" }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }

    if (path === "/init") {
      if (await this.session()) return json({ error: "Session exists" }, 409);
      if (typeof input.siteId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(input.siteId) ||
          typeof input.siteName !== "string" || !input.siteName.trim() || input.siteName.length > 120 ||
          typeof input.secretHash !== "string" || !/^[a-f0-9]{64}$/.test(input.secretHash) ||
          typeof input.resumeHash !== "string" || !/^[a-f0-9]{64}$/.test(input.resumeHash) ||
          typeof input.origin !== "string" || !/^https?:\/\//.test(input.origin) ||
          typeof input.canEdit !== "boolean") return json({ error: "Invalid session" }, 400);
      const expiresAt = Date.now() + ACTIVE_SESSION_MS;
      const persistentUntil = Date.now() + RECONNECT_IDLE_MS;
      await this.ctx.storage.put("session", {
        siteId: input.siteId,
        siteName: input.siteName,
        secretHash: input.secretHash,
        resumeHash: input.resumeHash,
        origin: input.origin,
        persistentUntil,
        canEdit: input.canEdit,
        claimed: false,
        revoked: false,
        expiresAt,
      });
      await this.scheduleCleanup(expiresAt);
      return json({ ok: true, expiresAt, persistentUntil });
    }

    if (path === "/claim") {
      const session = await this.session();
      // Only the authenticated, currently active editor socket may be claimed.
      // Replaced or half-closed sockets must not consume an OAuth pairing code.
      const connected = this.ctx.getWebSockets().some(socket =>
        socket.readyState === WebSocket.OPEN &&
        socket.deserializeAttachment()?.connectionId === session?.connectionId
      );
      if (!this.active(session) || session.claimed || !connected) {
        return json({ error: "This Tsumu session is unavailable or already paired" }, 410);
      }
      session.claimed = true;
      await this.ctx.storage.put("session", session);
      return json({ siteId: session.siteId, siteName: session.siteName, canEdit: session.canEdit });
    }

    if (path === "/revoke") {
      const session = await this.session();
      const byToken = typeof input.connectToken === "string" &&
        await sha256(input.connectToken) === session?.secretHash;
      const byCookie = this.validResume(session, input);
      if (!session || (!byToken && !byCookie)) return json({ error: "Forbidden" }, 403);
      session.revoked = true;
      await this.ctx.storage.put("session", session);
      for (const socket of this.ctx.getWebSockets()) {
        this.failSocket(socket);
        socket.close(1000, "Disconnected");
      }
      return json({ ok: true });
    }

    if (path === "/restore" || path === "/renew") return this.restoreOrRenew(path, input);
    if (path === "/info") {
      const session = await this.session();
      if (!session || session.revoked || !session.claimed || session.persistentUntil <= Date.now()) {
        return json({ error: "Session no longer authorized" }, 410);
      }
      const connected = this.ctx.getWebSockets().some(socket =>
        socket.readyState === WebSocket.OPEN && socket.deserializeAttachment()?.connectionId === session.connectionId
      );
      return json({ siteId: session.siteId, siteName: session.siteName, canEdit: session.canEdit, connected });
    }
    if (path === "/attach") {
      const session = await this.session();
      if (!session || session.revoked || session.persistentUntil <= Date.now() ||
          !session.connectionId || typeof input.connectToken !== "string" ||
          await sha256(input.connectToken) !== session.secretHash) return json({ error: "Forbidden" }, 403);
      const connected = this.ctx.getWebSockets().some(socket =>
        socket.readyState === WebSocket.OPEN && socket.deserializeAttachment()?.connectionId === session.connectionId
      );
      if (!connected) return json({ error: "Editor is not connected" }, 410);
      // Attachment validates an already live browser session. Only a valid
      // invitation in the grant registry can authorize the new site.
      // Do not mark a new session claimed before the invitation is consumed.
      if (!session.claimed) return json({ error: "Site must first be paired" }, 403);
      return json({ siteId: session.siteId, siteName: session.siteName, canEdit: session.canEdit });
    }
    if (path === "/call") return this.call(input);
    return json({ error: "Not found" }, 404);
  }

  active(session) {
    return !!session && !session.revoked && session.expiresAt > Date.now() &&
      session.persistentUntil > Date.now();
  }

  validResume(session, input) {
    if (!session || session.revoked || !session.claimed ||
        session.persistentUntil <= Date.now() ||
        input?.origin !== session.origin || input?.siteId !== session.siteId ||
        typeof input?.resumeHash !== "string") return false;
    return input.resumeHash === session.resumeHash ||
      (input.resumeHash === session.previousResumeHash && session.previousResumeUntil > Date.now());
  }

  async restoreOrRenew(path, input) {
    const session = await this.session();
    if (!this.validResume(session, input) ||
        typeof input.nextResumeHash !== "string" || !/^[a-f0-9]{64}$/.test(input.nextResumeHash) ||
        (path === "/restore" && (typeof input.secretHash !== "string" || !/^[a-f0-9]{64}$/.test(input.secretHash)))) {
      return json({ error: "Reconnect permission expired, revoked, or unavailable" }, 403);
    }
    const now = Date.now();
    session.previousResumeHash = session.resumeHash;
    session.previousResumeUntil = now + 30_000;
    session.resumeHash = input.nextResumeHash;
    session.persistentUntil = now + RECONNECT_IDLE_MS;
    session.expiresAt = now + ACTIVE_SESSION_MS;
    if (path === "/restore") {
      session.secretHash = input.secretHash;
      session.connectionId = null;
    }
    await this.ctx.storage.put("session", session);
    await this.scheduleCleanup(session.expiresAt);
    if (path === "/restore") {
      for (const socket of this.ctx.getWebSockets()) {
        this.failSocket(socket);
        socket.close(1000, "Replaced");
      }
    }
    return json({ siteId: session.siteId, canEdit: session.canEdit, expiresAt: session.expiresAt,
      persistentUntil: session.persistentUntil });
  }

  async connect(request) {
    const session = await this.session();
    if (!this.active(session)) return json({ error: "Session expired" }, 410);
    const protocols = (request.headers.get("Sec-WebSocket-Protocol") || "").split(",").map(s => s.trim());
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket" ||
        protocols[0] !== "tsumu-editor" || protocols.length !== 2 ||
        await sha256(protocols[1]) !== session.secretHash) {
      return json({ error: "Forbidden" }, 403);
    }
    // A previous socket can remain visible while its close event is in flight.
    // Persist the active connection ID so hibernation cannot revive an old socket.
    const connectionId = crypto.randomUUID();
    await this.ctx.storage.put("session", { ...session, connectionId });
    for (const socket of this.ctx.getWebSockets()) {
      this.failSocket(socket);
      socket.close(1000, "Replaced");
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role: "editor", connectionId });
    return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": "tsumu-editor" } });
  }

  async call(input) {
    const session = await this.session();
    if (!this.active(session) || !session.claimed) return json({ error: "Session expired or not authorized" }, 410);
    if (["apply_operations", "create_site", "create_page"].includes(input.action) && !session.canEdit) return json({ error: "Read-only connection" }, 403);
    if (!["list_sites", "list_pages", "get_page", "get_element", "apply_operations", "create_site", "create_page"].includes(input.action)) {
      return json({ error: "Unknown operation" }, 400);
    }
    const isWrite = ["apply_operations", "create_site", "create_page"].includes(input.action);
    const requestId = isWrite ? input.args?.requestId : crypto.randomUUID();
    if (typeof requestId !== "string" || !/^[\w-]{8,80}$/.test(requestId)) {
      return json({ error: "Invalid requestId" }, 400);
    }
    const fingerprint = isWrite ? await writeFingerprint(input.action, input.args) : undefined;
    if (isWrite) {
      const previous = await this.ctx.storage.get("result:" + requestId);
      const cached = cachedWriteResult(previous, fingerprint);
      if (cached) return json(cached.value, cached.status);
      if (this.pending.has(requestId)) return json({ error: "Operation already in progress" }, 409);
    }
    const socket = this.ctx.getWebSockets().find(
      candidate => candidate.deserializeAttachment()?.connectionId === session.connectionId
    );
    if (!socket) return json({ error: "The Tsumu browser tab is disconnected" }, 503);
    if (isWrite) {
      const expiresAt = Date.now() + RESULT_TTL_MS;
      await this.ctx.storage.put("result:" + requestId, { pending: true, fingerprint, expiresAt });
      await this.scheduleCleanup(expiresAt);
    }
    const result = await new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ status: 504, value: { error: "Browser response timed out; write outcome may be unknown" } });
      }, REQUEST_TIMEOUT_MS);
      const complete = (message) => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        if (message.transportError) {
          resolve({ status: 503, value: { error: "Browser disconnected; write outcome may be unknown" } });
          return;
        }
        resolve({ status: message.ok ? 200 : 409, value: message.ok ? { result: message.result } : { error: String(message.error || "Operation failed") } });
      };
      this.pending.set(requestId, { socket, complete });
      try { socket.send(JSON.stringify({ type: "request", requestId, action: input.action, args: input.args || {} })); }
      catch {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve({ status: 503, value: { error: "Browser disconnected" } });
      }
    });
    if (isWrite && result.status !== 504 && result.status !== 503) {
      await this.ctx.storage.put("result:" + requestId, { pending: false, ...result, fingerprint, expiresAt: Date.now() + RESULT_TTL_MS });
    }
    return json(result.value, result.status);
  }

  async webSocketMessage(socket, data) {
    if (typeof data !== "string" || data.length > 4 * 1024 * 1024) return;
    const session = await this.session();
    if (!this.active(session) || socket.deserializeAttachment()?.connectionId !== session.connectionId) return;
    let message;
    try { message = JSON.parse(data); } catch { return; }
    if (message?.type !== "response" || typeof message.requestId !== "string") return;
    const pending = this.pending.get(message.requestId);
    if (pending?.socket === socket) pending.complete(message);
  }

  webSocketClose(socket) {
    this.failSocket(socket);
  }

  webSocketError(socket) {
    this.failSocket(socket);
  }

  async alarm() {
    const session = await this.session();
    if (!session || session.revoked || session.persistentUntil <= Date.now() ||
        (!session.claimed && session.expiresAt <= Date.now())) {

      for (const socket of this.ctx.getWebSockets()) {
        this.failSocket(socket);
        socket.close(1000, "Session expired");
      }
      await this.ctx.storage.deleteAll();
      return;
    }
    const now = Date.now();
    if (session.expiresAt <= now) {
      for (const socket of this.ctx.getWebSockets()) {
        this.failSocket(socket);
        socket.close(1000, "Session expired");
      }
    }
    let next = session.expiresAt > now ? session.expiresAt : session.persistentUntil;
    for (const [key, value] of await this.ctx.storage.list({ prefix: "result:" })) {
      if (!value?.expiresAt || value.expiresAt <= now) await this.ctx.storage.delete(key);
      else next = Math.min(next, value.expiresAt);
    }
    await this.ctx.storage.setAlarm(Math.max(now + 1000, next));
  }
}
