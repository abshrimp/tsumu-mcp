import { readLimitedText } from "./request-body.js";
import { sha256 } from "./pair-code.js";
import { skillFiles } from "./generated-skills.js";
import { stageSiteDoc } from "./drafts.js";

const ORIGIN = "https://mcp.tsumu.ebii.net";
const enc = new TextEncoder();
const escape = value => String(value).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const headers = {
  "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
// Form documents retain Origin on same-origin POST; sample links remain no-referrer.
function page(content, status = 200, referrerPolicy = "no-referrer") {
  return new Response("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Tsumu review sample</title><style>body{font:16px/1.6 system-ui;max-width:640px;margin:48px auto;padding:24px}label,input{display:block}input{margin:4px 0 16px;padding:8px}button{padding:10px}a{overflow-wrap:anywhere}</style><h1>Tsumu review sample</h1>" + content + "</html>", { status, headers: { ...headers, "Referrer-Policy": referrerPolicy } });
}
const login = "<p>Dedicated reviewer access. This login creates only a disposable synthetic sample, not an MCP authorization.</p><form method='post' action='/review'><label>Username<input name='username' autocomplete='username' maxlength='100' required></label><label>Password<input name='password' type='password' autocomplete='current-password' maxlength='256' required></label><button type='submit'>Sign in and prepare sample</button></form>";
function config(env) {
  const match = /^pbkdf2-sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(env.REVIEW_PASSWORD_HASH || "");
  if (!match || typeof env.REVIEW_USERNAME !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(env.REVIEW_USERNAME)) return null;
  return { salt: Uint8Array.from(match[1].match(/../g), x => parseInt(x, 16)), hash: match[2], username: env.REVIEW_USERNAME };
}
function equal(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export function reviewFixture() {
  const doc = JSON.parse(skillFiles["tsumu-build-site/references/minimal-site.json"]);
  doc.siteName = "Tsumu reviewer sample";
  doc.lang = "en";
  Object.assign(doc.pages.page_home, { name: "Home", title: doc.siteName, description: "Synthetic review fixture" });
  doc.nodes.node_heading.text.content = "Tsumu Review Home";
  doc.nodes.node_description.text.content = "A disposable synthetic site for review. Edit this sample without publishing.";
  doc.nodes.node_link.text.content = "Review sample";
  doc.pages.page_404 = { id: "page_404", name: "404", slug: "404", title: "Not found", description: "Synthetic error page", children: [] };
  doc.pageOrder = ["page_home", "page_404"];
  // No outgoing links, remote assets, scripts, or user-provided data in the sample.
  for (const node of Object.values(doc.nodes)) node.link = null;
  return doc;
}
async function quota(env, key, limit) {
  return env.PAIRINGS.getByName("review-login").fetch("https://internal/quota", {
    method: "POST", body: JSON.stringify({ requester: await sha256(key), limit }),
  });
}
/** Separate sample login: no OAuth grants, pairing bypass, or access to real sites. */
export async function reviewPage(request, env) {
  const settings = config(env);
  if (!settings || new URL(request.url).origin !== ORIGIN) return new Response("Not found", { status: 404, headers });
  if (request.method === "GET") return page(login, 200, "same-origin");
  if (request.method !== "POST") return page("<p>Method not allowed.</p>", 405);
  if (request.headers.get("Origin") !== ORIGIN || request.headers.get("Sec-Fetch-Site") === "cross-site") return page("<p>Same-origin sign-in required.</p>", 403);
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return page("<p>Invalid form.</p>", 415);
  const raw = await readLimitedText(request, 2048);
  if (raw === null) return page("<p>Invalid form.</p>", 413);
  try {
    // Dedicated object and namespaced keys never spend normal pairing quota.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    for (const [key, limit] of [["review-ip:" + ip, 3], ["review-global", 12]]) {
      const result = await quota(env, key, limit);
      if (!result.ok) return page("<p>Sign-in temporarily unavailable. Please try later.</p>", result.status === 429 ? 429 : 503);
    }
    const form = new URLSearchParams(raw);
    const password = form.get("password") || "";
    if (!password || password.length > 256) return page("<p>Invalid username or password.</p>" + login, 401, "same-origin");
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 100000, salt: settings.salt }, key, 256));
    const actual = Array.from(bits, b => b.toString(16).padStart(2, "0")).join("");
    const validPassword = equal(actual, settings.hash);
    const validUsername = equal(await sha256(form.get("username") || ""), await sha256(settings.username));
    if (!validPassword || !validUsername) return page("<p>Invalid username or password.</p>" + login, 401, "same-origin");
    const sample = await stageSiteDoc({ ...env, PAIRINGS: { getByName: () => env.PAIRINGS.getByName("review-drafts") } }, "review-synthetic-fixture", reviewFixture());
    return page("<p>Signed in. A fresh synthetic sample is ready. It expires in one hour and can be imported once.</p><p><a href='" + escape(sample.importUrl) + "' target='_blank' rel='noopener noreferrer'>Open sample site</a></p><ol><li>Use a fresh browser profile with no existing Tsumu sites or hosting accounts. Open the sample in that profile. This creates a separate browser-local site.</li><li>Keep the editor tab open. In AI connection (MCP), enable editing and generate a normal temporary connection code.</li><li>Return to the ChatGPT connection flow and enter that code on Tsumu's normal consent page. This reviewer login is not the connection code.</li><li>List pages, read Home, then add a page with heading Welcome to Tsumu. Inspect the result in the editor.</li><li>Do not connect a hosting account, publish, or delete. Close the review profile when finished.</li></ol><p>For another clean sample, return here and sign in again. No real user sites are included. Keep the sample link private.</p>");
  } catch {
    // Never log credentials, body, generated import URL, or exception payloads.
    return page("<p>Sample preparation temporarily unavailable. Please try later.</p>", 503);
  }
}
