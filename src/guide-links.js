/**
 * Public listing URLs for each AI client's Tsumu plugin.
 *
 * Set each value once that listing is approved and its public URL verified.
 * The guide (GET /) is meant to go public only after every listing is set;
 * until then a client shows "Coming soon". The Tsumu editor reads the same
 * list from GET /plugins.json and shows only published plugins.
 */
/**
 * Which guide GET / serves.
 *   "manual"  — step-by-step manual MCP setup for each AI app (used while the
 *               plugin listings are still under review).
 *   "plugins" — the plugin guide: one "Get the plugin" button per app.
 * Switch back to "plugins" once every listing in pluginLinks is set.
 */
export const GUIDE_MODE = "manual";

export const pluginLinks = {
  chatgpt: null,
  claude: null,
  cursor: null,
  gemini: null,
  antigravity: null,
};

/** Display order, names and icons (public/plugin-icons/<id>.svg) of supported clients. */
export const PLUGIN_CLIENTS = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "claude", name: "Claude" },
  { id: "cursor", name: "Cursor" },
  { id: "gemini", name: "Gemini CLI" },
  { id: "antigravity", name: "Google Antigravity" },
];

export const pluginIconPath = id => "/plugin-icons/" + id + ".svg";

/** Accept only absolute https:// URLs so a typo can never become a script or relative link. */
export function safePluginUrl(value) {
  if (typeof value !== "string" || value === "") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The list the Tsumu editor shows in its MCP connection dialog: only clients
 * whose plugin is published. Icons are absolute so a self-hosted editor can use
 * them as-is.
 */
export function pluginCatalog(origin) {
  return {
    guideUrl: origin + "/",
    plugins: PLUGIN_CLIENTS.flatMap(({ id, name }) => {
      const url = safePluginUrl(pluginLinks[id]);
      return url ? [{ id, name, icon: origin + pluginIconPath(id), url }] : [];
    }),
  };
}

export function pluginCatalogResponse(request) {
  const origin = new URL(request.url).origin;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method === "HEAD") return new Response(null, { headers: { ...headers, "Content-Type": "application/json" } });
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { ...headers, Allow: "GET, HEAD, OPTIONS" } });
  }
  return Response.json(pluginCatalog(origin), { headers });
}
