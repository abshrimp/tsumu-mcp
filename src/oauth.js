import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { normalizeCode, sha256 } from "./pair-code.js";
import { redeemPairing, redeemPairings } from "./bridge.js";
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
  let pendingBatch = null;
  let attemptedGrantId = null;
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
    let codes = [];
    if (decision === "approve") {
      if (form.has("codes")) {
        // Official multi-site consent submits an explicit, bounded array of
        // one-time codes; manual connection codes remain a separate path.
        if (form.has("code")) return errorResponse(locale, "invalidCode");
        let parsed;
        try { parsed = JSON.parse(form.get("codes")); } catch { return errorResponse(locale, "invalidCode"); }
        if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 12 ||
            parsed.some(item => typeof item !== "string")) {
          return errorResponse(locale, "invalidCode");
        }
        codes = parsed.map(item => normalizeCode(item));
      } else {
        codes = [normalizeCode(form.get("code"))];
      }
      if (codes.some(item => !item) || new Set(codes).size !== codes.length) {
        return errorResponse(locale, "invalidCode");
      }
    }

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
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const paired = codes.length === 1
        ? [await redeemPairing(env, codes[0], ip)]
        : (pendingBatch = await redeemPairings(env, codes, ip)).sites;
      const pairedSites = paired.map(site => ({
        siteId: site.siteId, siteName: site.siteName,
        sessionId: site.sessionId, canEdit: site.canEdit,
      }));
      if (new Set(pairedSites.map(site => site.sessionId)).size !== pairedSites.length) {
        throw new Error("Invalid pairing code");
      }
      userId = crypto.randomUUID();
      attemptedGrantId = pendingBatch ? userId : null;
      const grant = await env.PAIRINGS.getByName("global").fetch("https://internal/grant/create", {
        method: "POST",
        body: JSON.stringify({ grantId: userId, sites: pairedSites }),
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
    // The pending claim secret is discarded only after OAuth has issued a
    // redirect. Stale approvals must not be able to unclaim successful grants.
    if (pendingBatch) await pendingBatch.confirm();
    return new Response(null, { status: 302, headers: consentHeaders });
  } catch (error) {
    if (pendingBatch) {
      // If the grant creation response was lost, it might still have succeeded.
      // Never make an already-authorized session's codes reusable unless that
      // potentially created grant has first been removed successfully.
      let safeToRollback = !attemptedGrantId;
      if (attemptedGrantId) {
        try {
          const aborted = await env.PAIRINGS.getByName("global").fetch("https://internal/grant/abort", {
            method: "POST", body: JSON.stringify({ grantId: attemptedGrantId }),
          });
          safeToRollback = aborted.ok;
        } catch { /* Fail closed: do not release possibly authorized sessions. */ }
      }
      if (safeToRollback) await pendingBatch.rollback();
    }
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
