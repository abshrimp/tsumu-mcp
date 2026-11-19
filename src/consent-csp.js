/**
 * Chrome and Safari enforce form-action against redirects after a form POST,
 * not just the form's action URL. The OAuth callback's origin must therefore
 * be permitted as well as this authorization server's own origin.
 *
 * redirectUri is obtained from parseAuthRequest(), which validates it against
 * the client's registered redirect URIs. Never use the user-provided query
 * string or an unvalidated client redirect directly here.
 */
export function consentCsp(redirectUri) {
  const callback = new URL(redirectUri);
  const scheme = callback.protocol;
  if (scheme !== "http:" && scheme !== "https:") {
    throw new Error("Unsupported OAuth callback scheme");
  }
  // Known client icons are served from this origin; arbitrary domains provided
  // by a client are never added to this policy.
  return "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; " +
    "form-action 'self' " + callback.origin + "; " +
    "frame-ancestors 'none'; base-uri 'none'";
}
