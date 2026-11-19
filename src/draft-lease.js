/** A claim receipt is only valid while both the draft and its lease are active. */
export function canCompleteDraft(meta, secretHash, receiptHash, now = Date.now()) {
  return meta?.ready === true &&
    meta.expiresAt > now &&
    meta.hash === secretHash &&
    meta.lease?.until > now &&
    meta.lease.hash === receiptHash;
}
