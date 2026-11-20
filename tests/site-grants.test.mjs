import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryStorage } from "./helpers/durable-object.mjs";
import { siteGrantsRequest } from "../src/site-grants.js";

const grantId = "12345678-1234-4234-8234-123456789abc";
const first = { siteId: "site-a", siteName: "Alpha", sessionId: "abcdef01-1234-4234-8234-abcdef012345", canEdit: false };
const second = { siteId: "site-b", siteName: "Beta", sessionId: "abcdef02-1234-4234-8234-abcdef012345", canEdit: true };
const call = (storage, path, args = {}) =>
  siteGrantsRequest(storage, "/grant/" + path, { grantId, ...args });

test("grant creation, listing and site selection never allow unapproved sites", async () => {
  const storage = memoryStorage();
  assert.equal((await call(storage, "create", { sites: [first] })).status, 200);
  assert.equal((await call(storage, "create", { sites: [first] })).status, 409);
  assert.deepEqual(await (await call(storage, "list")).json(),
    { sites: [first], activeSiteId: "site-a", activeSiteRef: first.sessionId });
  assert.equal((await call(storage, "select", { siteId: "site-b" })).status, 403);
  assert.deepEqual(await (await call(storage, "resolve")).json(),
    { ...first, activeSiteId: "site-a", activeSiteRef: first.sessionId });

  const invite = await (await call(storage, "invite")).json();
  assert.match(invite.ticket, /^[A-Za-z0-9_-]{43}$/);
  const attached = await call(storage, "add", { ticket: invite.ticket, site: second });
  assert.equal(attached.status, 200);
  assert.equal((await call(storage, "add", { ticket: invite.ticket, site: second })).status, 410,
    "one-use invitations cannot add a site twice");
  assert.equal((await call(storage, "select", { siteId: "site-b" })).status, 200);
  const grant = await (await call(storage, "list")).json();
  assert.equal(grant.activeSiteId, "site-b");
  assert.deepEqual(grant.sites.map(site => site.siteId), ["site-a", "site-b"]);
  assert.equal((await call(storage, "select", { siteId: "unapproved" })).status, 403);
});

test("grant records cannot be shared through malformed IDs or expired invitations", async () => {
  const storage = memoryStorage();
  assert.equal((await siteGrantsRequest(storage, "/grant/create",
    { grantId: "../bad", sites: [first] })).status, 400);
  await call(storage, "create", { sites: [first] });
  const invite = await (await call(storage, "invite")).json();
  const invitationKey = [...storage.records.keys()].find(key => key.startsWith("invite:"));
  assert.ok(invitationKey);
  const entry = await storage.get(invitationKey);
  await storage.put(invitationKey, { ...entry, expiresAt: Date.now() - 1 });
  assert.equal((await call(storage, "add", { ticket: invite.ticket, site: second })).status, 410);
  const grant = await storage.get("grant:" + grantId);
  await storage.put("grant:" + grantId, { ...grant, expiresAt: Date.now() - 1 });
  assert.equal((await call(storage, "list")).status, 410);
});

test("site IDs from independent editors cannot silently replace one another", async () => {
  const storage = memoryStorage();
  const duplicate = { ...second, siteId: first.siteId, siteName: "Another editor's Alpha" };
  await call(storage, "create", { sites: [first] });
  const invite = await (await call(storage, "invite")).json();
  assert.equal((await call(storage, "add", { ticket: invite.ticket, site: duplicate })).status, 200);
  const listing = await (await call(storage, "list")).json();
  assert.deepEqual(listing.sites.map(site => site.siteId), ["site-a", "site-a"]);
  assert.equal(listing.activeSiteRef, second.sessionId);
  assert.equal((await call(storage, "select", { siteId: "site-a" })).status, 409);
  const result = await (await call(storage, "select", { siteRef: first.sessionId })).json();
  assert.equal(result.activeSiteRef, first.sessionId);
  assert.equal((await (await call(storage, "resolve")).json()).sessionId, first.sessionId);
});

test("an active grant extends its seven-day idle expiry without reviving expired grants", async () => {
  const storage = memoryStorage();
  await call(storage, "create", { sites: [first] });
  const key = "grant:" + grantId;
  const existing = await storage.get(key);
  await storage.put(key, { ...existing, expiresAt: Date.now() + 1000 });
  await call(storage, "resolve");
  assert.ok((await storage.get(key)).expiresAt > Date.now() + 6 * 24 * 60 * 60_000);
  await storage.put(key, { ...existing, expiresAt: Date.now() + 1000 });
  await call(storage, "list");
  assert.ok((await storage.get(key)).expiresAt > Date.now() + 6 * 24 * 60 * 60_000);
  await storage.put(key, { ...existing, expiresAt: Date.now() - 1 });
  assert.equal((await call(storage, "resolve")).status, 410);
  assert.equal((await call(storage, "invite")).status, 410);
});

test("new invitations replace old ones and cannot accumulate without bound", async () => {
  const storage = memoryStorage();
  await call(storage, "create", { sites: [first] });
  const firstInvite = await (await call(storage, "invite")).json();
  const newerInvite = await (await call(storage, "invite")).json();
  assert.notEqual(firstInvite.ticket, newerInvite.ticket);
  assert.equal((await call(storage, "inspect", { ticket: firstInvite.ticket })).status, 410);
  assert.equal((await call(storage, "add", { ticket: firstInvite.ticket, site: second })).status, 410);
  assert.equal((await call(storage, "inspect", { ticket: newerInvite.ticket })).status, 200);
  assert.equal([...storage.records.keys()].filter(key => key.startsWith("invite:")).length, 1);
  assert.equal((await call(storage, "add", { ticket: newerInvite.ticket, site: second })).status, 200);
  assert.equal([...storage.records.keys()].filter(key => key.startsWith("invite:")).length, 0);
});

test("a full grant rejects an added site without consuming the invitation", async () => {
  const storage = memoryStorage();
  const sites = Array.from({ length: 12 }, (_, i) => ({
    siteId: "site-" + i,
    siteName: "Site " + i,
    sessionId: crypto.randomUUID(),
    canEdit: true,
  }));
  await call(storage, "create", { sites });
  const invite = await (await call(storage, "invite")).json();
  assert.equal((await call(storage, "add", { ticket: invite.ticket, site: second })).status, 400);
  assert.equal((await call(storage, "inspect", { ticket: invite.ticket })).status, 200);
});


test("aborted OAuth grants are removed instead of leaving orphaned site permissions", async () => {
  const storage = memoryStorage();
  assert.equal((await call(storage, "create", { sites: [first, second] })).status, 200);
  assert.ok(await storage.get("grant:" + grantId));
  const aborted = await call(storage, "abort");
  assert.equal(aborted.status, 200);
  assert.deepEqual(await aborted.json(), { aborted: true });
  assert.equal(await storage.get("grant:" + grantId), undefined);
  assert.equal((await call(storage, "list")).status, 410);
  assert.equal((await call(storage, "abort")).status, 200,
    "aborting an already absent grant should be idempotent");
});
