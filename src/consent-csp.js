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
  // The ChatGPT OAuth relay redirects from chatgpt.com to platform.openai.com.
  // Chrome and Safari enforce form-action across that redirect as well.
  // Only allow this additional origin for the exact, validated ChatGPT callback.
  const relayOrigin = callback.origin === "https://chatgpt.com" &&
    callback.pathname === "/connector_platform_oauth_redirect"
    ? " https://platform.openai.com"
    : "";
  return "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; " +
    "frame-src https://tsumu.ebii.net; " +
    "form-action 'self' " + callback.origin + relayOrigin + "; " +
    "frame-ancestors 'none'; base-uri 'none'";
}
