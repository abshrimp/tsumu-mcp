// Origin is a browser-context guard, not an authorization credential.
// The pairing code and the separate WebSocket token protect each session.
export function allowedBrowserOrigin(origin) {
  if (typeof origin !== "string" || origin === "null") return null;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  // Browser Origin headers contain exactly one canonical origin, not a URL.
  if (url.origin !== origin) return null;
  if (url.protocol === "https:") return origin;
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return origin;
  }
  return null;
}
