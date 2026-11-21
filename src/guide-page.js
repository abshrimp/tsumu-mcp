import { landingHtml } from "./landing-html.js";

// The landing page is served verbatim from the supplied standalone HTML.
// Keep OAuth and MCP handling separate from this public page.
export function guidePage() {
  return landingHtml;
}

// Restrict the inline script to the exact SHA-256 of the supplied script.
export const guideCsp = "default-src 'none'; style-src 'unsafe-inline'; " +
  "script-src 'sha256-50Ac1VFsi6LBVhXMWFnIRa5yW0/EBXNkWWr5h+bb4hE='; " +
  "img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function guideResponse(_locale, method = "GET") {
  return new Response(method === "HEAD" ? null : landingHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": guideCsp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
