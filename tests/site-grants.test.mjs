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
    { sites: [first], activeSiteId: "site-a" });
  assert.equal((await call(storage, "select", { siteId: "site-b" })).status, 403);
  assert.deepEqual(await (await call(storage, "resolve")).json(),
    { ...first, activeSiteId: "site-a" });

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
