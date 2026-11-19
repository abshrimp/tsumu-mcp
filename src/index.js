import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { bridgeRequest } from "./bridge.js";
import { importDraftRequest } from "./drafts.js";
import { authorize } from "./oauth.js";
import { guideResponse } from "./guide-page.js";
import { pluginCatalogResponse } from "./guide-links.js";
import { consentLocale } from "./consent-locales.js";
import { serveAuthenticatedMcp } from "./mcp-handler.js";

export { PairingRegistry } from "./pairings.js";
export { ImportDraft } from "./import-draft.js";
export { BrowserSession } from "./room.js";

const RESOURCE = "https://mcp.tsumu.ebii.net/mcp";
const ISSUER = "https://mcp.tsumu.ebii.net";

const defaultHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (url.origin === ISSUER && pathname === "/.well-known/openai-apps-challenge" && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(request.method === "HEAD" ? null : "IU-4_L-YbSiOtFhVeLwWXsEZ78mE4kI6wJhPe3xTgyI", {
        headers: { "Content-Type": "text/plain" },
      });
    }
    if (pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      // ?lang=ja|en wins; otherwise the browser's Accept-Language decides (English by default).
      return guideResponse(consentLocale(request), request.method);
    }
    if (pathname === "/plugins.json") return pluginCatalogResponse(request);
    if (pathname === "/authorize") return authorize(request, env);
    if (pathname.startsWith("/bridge/")) return bridgeRequest(request, env);
    if (pathname.startsWith("/drafts/")) return importDraftRequest(request, env);
    if (pathname === "/health") return Response.json({ status: "ok", service: "tsumu-mcp" });
    return new Response("Not found", { status: 404 });
  },
};

const apiHandler = {
  fetch: serveAuthenticatedMcp,
};

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler,
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: ["tsumu:access"],
  requiredScopes: ["tsumu:access"],
  resourceMetadata: { resource: RESOURCE, authorization_servers: [ISSUER] },
  clientIdMetadataDocumentEnabled: true,
});
