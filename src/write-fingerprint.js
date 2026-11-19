import { sha256 } from "./pair-code.js";

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ":" + stableJson(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}

/** A requestId may only replay the exact same write operation. */
export async function writeFingerprint(action, args) {
  return sha256(stableJson({ action, args }));
}

export function cachedWriteResult(previous, fingerprint, now = Date.now()) {
  if (!previous || previous.expiresAt <= now) return null;
  if (previous.fingerprint !== fingerprint) {
    return { status: 409, value: { error: "requestId was already used for a different operation" } };
  }
  if (previous.pending) {
    return { status: 409, value: { error: "Outcome unknown. Read the page before retrying with a different requestId." } };
  }
  return { status: previous.status, value: previous.value };
}
