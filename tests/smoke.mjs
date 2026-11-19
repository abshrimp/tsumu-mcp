import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import WebSocket from "ws";
import { createHash, randomBytes } from "node:crypto";

const port = 8799;
const base = "http://127.0.0.1:" + port;
const goodOrigin = "https://tsumu.ebii.net";
const selfHostedOrigin = "https://tsumu.example.org";
const localOrigin = "http://localhost:3000";
const body = JSON.stringify({ siteId: "demo", siteName: "Demo site", canEdit: true });

const child = spawn("npx", ["wrangler", "dev", "--local", "--ip", "127.0.0.1", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let output = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", data => { output = (output + data).slice(-5000); });
}

async function waitForWorker() {
  for (let i = 0; i < 70; i++) {
    if (child.exitCode !== null) throw new Error("Wrangler exited before startup:\n" + output);
    try {
      const response = await fetch(base + "/health", { signal: AbortSignal.timeout(900) });
      if (response.ok && (await response.json()).status === "ok") return;
    } catch { /* Worker has not started yet. */ }
    await pause(300);
  }
  throw new Error("Worker did not start:\n" + output);
}

async function main() {
  await waitForWorker();
  for (const [path, type, signature] of [
    ["/favicon.svg", /^image\/svg\+xml\b/, Buffer.from("<svg")],
    ["/favicon.png", /^image\/png\b/, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["/favicon.ico", /^image\/(x-icon|vnd\.microsoft\.icon)\b/, Buffer.from([0, 0, 1, 0])],
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") || "", type, path);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes.subarray(0, signature.length), signature, path);
    const head = await fetch(base + path, { method: "HEAD" });
    assert.equal(head.status, 200, path);
    assert.match(head.headers.get("content-type") || "", type, path);
    assert.equal((await head.arrayBuffer()).byteLength, 0, path);
  }

  const guide = await fetch(base + "/", { headers: { "Accept-Language": "ja-JP,ja;q=0.9" } });
  assert.equal(guide.status, 200, "connection guide must be public");
  assert.match(guide.headers.get("content-type") || "", /text\/html/);
  assert.match(await guide.text(), /<html lang='ja'>/);
  assert.match(await (await fetch(base + "/?lang=en")).text(), /<html lang='en'>/);
  const screenshot = await fetch(base + "/guide/ja/consent-code.webp");
  assert.equal(screenshot.status, 200, "guide screenshots are served as static assets");
  const icon = await fetch(base + "/plugin-icons/claude.svg");
  assert.equal(icon.status, 200);
  const catalog = await fetch(base + "/plugins.json", { headers: { Origin: "https://tsumu.ebii.net" } });
  assert.equal(catalog.status, 200);
  assert.equal(catalog.headers.get("access-control-allow-origin"), "*");
  assert.ok(Array.isArray((await catalog.json()).plugins));

  const untrustedMcp = await fetch(base + "/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } }),
  });
  assert.equal(untrustedMcp.status, 401, "MCP tools require OAuth");
  assert.match(untrustedMcp.headers.get("www-authenticate") || "", /Bearer/i);

  const draftPath = "/drafts/12345678-1234-4234-8234-123456789abc/claim";
  const draftPreflight = await fetch(base + draftPath, {
    method: "OPTIONS",
    headers: { Origin: selfHostedOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization" },
  });
  assert.equal(draftPreflight.status, 204);
  assert.equal(draftPreflight.headers.get("access-control-allow-origin"), selfHostedOrigin);
  const forbiddenDraft = await fetch(base + draftPath, {
    method: "POST", headers: { Origin: selfHostedOrigin, Authorization: "Bearer " + "a".repeat(43) },
  });
  assert.equal(forbiddenDraft.status, 404, "unowned or expired drafts are never readable");
  assert.equal(forbiddenDraft.headers.get("cache-control"), "no-store");

  const preflight = await fetch(base + "/bridge/sessions", {
    method: "OPTIONS",
    headers: { Origin: goodOrigin, "Access-Control-Request-Method": "POST" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), goodOrigin);
  for (const origin of [selfHostedOrigin, localOrigin, "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    const response = await fetch(base + "/bridge/sessions", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    });
    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), null);
  }
  for (const origin of ["null", "http://evil.example", "https://evil.example/path"]) {
    const response = await fetch(base + "/bridge/sessions", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }

  const noOrigin = await fetch(base + "/bridge/sessions", {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  assert.equal(noOrigin.status, 403, "a browser-origin check is mandatory");

  const insecureOrigin = await fetch(base + "/bridge/sessions", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://evil.example" }, body,
  });
  assert.equal(insecureOrigin.status, 403);

  const created = await fetch(base + "/bridge/sessions", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: selfHostedOrigin }, body,
  });
  const responseText = await created.text();
  assert.equal(created.status, 200, responseText);
  const result = JSON.parse(responseText);
  assert.match(result.pairingCode, /^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
  assert.match(result.connectToken, /^[\w-]{40,}$/);
  assert.match(result.wsUrl, /^ws:\/\/127\.0\.0\.1:8799\/bridge\/connect\?session=/);

  const ws = new WebSocket(result.wsUrl, ["tsumu-editor", result.connectToken], { headers: { Origin: selfHostedOrigin } });
  let replacement;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket handshake timed out")), 5000);
      ws.once("open", () => { clearTimeout(timeout); resolve(); });
      ws.once("error", err => { clearTimeout(timeout); reject(err); });
    });
    assert.equal(ws.protocol, "tsumu-editor");
    // A reconnect replaces the old browser socket without changing the session token.
    replacement = new WebSocket(result.wsUrl, ["tsumu-editor", result.connectToken], { headers: { Origin: selfHostedOrigin } });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Replacement WebSocket timed out")), 5000);
      replacement.once("open", () => { clearTimeout(timeout); resolve(); });
      replacement.once("error", err => { clearTimeout(timeout); reject(err); });
    });
    // Wrangler's local WebSocket hibernation may leave an old peer in CLOSING
    // even after its close frame was sent. It must no longer be OPEN.
    for (let attempt = 0; attempt < 20 && ws.readyState === WebSocket.OPEN; attempt++) {
      await pause(100);
    }
    assert.notEqual(ws.readyState, WebSocket.OPEN, "replaced WebSocket must stop accepting messages");
    assert.equal(replacement.readyState, WebSocket.OPEN);
    assert.equal(replacement.protocol, "tsumu-editor");
    // Exercise OAuth browser consent and PKCE token exchange against the
    // locally running Worker, not just mocked helper methods.
    const callbackUri = "http://127.0.0.1:8798/oauth/callback";
    const registered = await fetch(base + "/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Tsumu connection smoke test",
        redirect_uris: [callbackUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });
    assert.equal(registered.ok, true, await registered.clone().text());
    const client = await registered.json();
    assert.ok(client.client_id);

    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorizeUrl = new URL(base + "/authorize");
    for (const [key, value] of Object.entries({
      client_id: client.client_id,
      redirect_uri: callbackUri,
      response_type: "code",
      scope: "tsumu:access",
      state: "smoke-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: "https://mcp.tsumu.ebii.net/mcp",
    })) authorizeUrl.searchParams.set(key, value);

    const consent = await fetch(authorizeUrl, { redirect: "manual" });
    assert.equal(consent.status, 200, await consent.clone().text());
    assert.match(consent.headers.get("content-security-policy") || "", /form-action/);
    const cookie = consent.headers.get("set-cookie")?.split(";")[0];
    const consentHtml = await consent.text();
    const handle = /name='handle' value='([^']+)'/.exec(consentHtml)?.[1];
    assert.ok(handle && cookie, "OAuth consent must include a bound handle and cookie");

    const approved = await fetch(base + "/authorize", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        handle, decision: "approve", code: result.pairingCode, lang: "en",
      }),
      redirect: "manual",
    });
    assert.equal(approved.status, 302, await approved.clone().text());
    const redirect = new URL(approved.headers.get("location"));
    assert.equal(redirect.origin + redirect.pathname, callbackUri);
    assert.equal(redirect.searchParams.get("state"), "smoke-state");
    const authCode = redirect.searchParams.get("code");
    assert.ok(authCode, "Consent must return a short-lived authorization code");

    const tokenResponse = await fetch(base + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: callbackUri,
        client_id: client.client_id,
        code_verifier: verifier,
        resource: "https://mcp.tsumu.ebii.net/mcp",
      }),
    });
    assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text());
    const tokens = await tokenResponse.json();
    assert.ok(tokens.access_token, "OAuth must issue an MCP access token");

    // This local Worker is accessed at 127.0.0.1, whereas the OAuth
    // protected resource is the production HTTPS origin. A token minted for
    // the real resource must not be accepted on a different audience.
    const localAudience = await fetch(base + "/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + tokens.access_token,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-11-25",
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 42, method: "tools/list",
      }),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(localAudience.status, 401);
    assert.match(await localAudience.text(), /Token audience does not match resource server/);

    const revoked = await fetch(base + "/bridge/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: selfHostedOrigin },
      body: JSON.stringify({ sessionId: result.sessionId, connectToken: result.connectToken }),
    });
    assert.equal(revoked.status, 200);
  } finally {
    ws.terminate();
    replacement?.terminate();
  }
  console.log("Worker HTTP, CORS, pairing, OAuth consent/token, audience isolation and WebSocket smoke test passed");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
 } finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  child.stdout.destroy();
  child.stderr.destroy();
}
