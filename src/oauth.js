import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { normalizeCode, sha256 } from "./pair-code.js";
import { redeemPairing } from "./bridge.js";
import { consentCsp } from "./consent-csp.js";
import { consentLocale, consentErrorKey } from "./consent-locales.js";
import { consentPage, consentErrorPage } from "./consent-page.js";
import { readLimitedText } from "./request-body.js";

const MAX_CONSENT_FORM_BYTES = 4096;

const htmlHeaders = (headers, csp) => {
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Security-Policy", csp);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
};

const errorResponse = (locale, key, status = 400, headers = new Headers()) => new Response(consentErrorPage(locale, key), {
  status,
  headers: htmlHeaders(headers, "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"),
});

export async function authorize(request, env) {
  const oauth = env.OAUTH_PROVIDER;
  let locale = consentLocale(request);
  let consentHeaders;
  try {
    if (request.method === "GET") {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const csp = consentCsp(authRequest.redirectUri);
      const consent = await oauth.beginConsent(authRequest);
      return new Response(consentPage(details, consent.handle, request, locale), {
        headers: htmlHeaders(consent.headers, csp),
      });
    }
    if (request.method !== "POST") return errorResponse(locale, "genericError", 405);
    const mediaType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/x-www-form-urlencoded") return errorResponse(locale, "invalidRequest", 415);
    const body = await readLimitedText(request, MAX_CONSENT_FORM_BYTES);
    if (body === null) return errorResponse(locale, "invalidRequest", 413);
    const form = new URLSearchParams(body);
    locale = consentLocale(request, form.get("lang"));
    const handle = form.get("handle") || "";
    const decision = form.get("decision");
    if (decision === "deny") {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    if (decision !== "approve" && decision !== "draft") return errorResponse(locale, "invalidRequest");
    const code = decision === "approve" ? normalizeCode(form.get("code")) : null;
    if (decision === "approve" && !code) return errorResponse(locale, "invalidCode");

    // Validate browser-bound consent before spending quota or claiming a pairing.
    const approved = await oauth.approveConsent(request, handle, { scope: ["tsumu:access"] });
    consentHeaders = approved.headers;
    let userId;
    let props;
    if (decision === "draft") {
      // A draft-only grant may stage a new site but cannot inspect or edit any paired site.
      // No Tsumu editor tab or pairing code is necessary for this restricted consent.
      const requester = await sha256("draft-consent:" + (request.headers.get("CF-Connecting-IP") || "unknown"));
      const quota = await env.PAIRINGS.getByName("global").fetch("https://internal/quota", {
        method: "POST", body: JSON.stringify({ requester, limit: 3 }),
      });
      if (!quota.ok) {
        return errorResponse(locale, quota.status === 429 ? "tooMany" : "genericError",
          quota.status === 429 ? 429 : 503, consentHeaders);
      }
      userId = crypto.randomUUID();
      props = { draftOnly: true, draftGrantId: userId };
    } else {
      const paired = await redeemPairing(env, code, request.headers.get("CF-Connecting-IP") || "unknown");
      userId = crypto.randomUUID();
      const grant = await env.PAIRINGS.getByName("global").fetch("https://internal/grant/create", {
        method: "POST",
        body: JSON.stringify({ grantId: userId, sites: [{
          siteId: paired.siteId, siteName: paired.siteName,
          sessionId: paired.sessionId, canEdit: paired.canEdit,
        }] }),
      });
      if (!grant.ok) throw new Error("Unable to register the authorized site");
      props = { grantId: userId };
    }
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId,
      metadata: {},
      scope: approved.request.scope,
      props,
    });
    consentHeaders.set("Location", redirectTo);
    return new Response(null, { status: 302, headers: consentHeaders });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) {
      return Response.redirect(error.redirectTo, 302);
    }
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      return errorResponse(locale, "invalidRequest", 400, consentHeaders);
    }
    const key = consentErrorKey(error instanceof Error ? error.message : "");
    // A malformed or expired pairing is a user error. Worker/KV/OAuth faults
    // are temporary server failures, not evidence that the user's code expired.
    const status = key === "tooMany" ? 429
      : key === "invalidCode" || key === "expiredCode" ? 400 : 503;
    return errorResponse(locale, key, status, consentHeaders);
  }
}
