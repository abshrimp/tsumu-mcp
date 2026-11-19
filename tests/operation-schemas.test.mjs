import assert from "node:assert/strict";
import { test } from "node:test";
import { aiOperation, aiNode } from "../src/schemas.js";

test("accept documented Tsumu operation variants", () => {
  for (const op of [
    { op: "set_text", id: "heading-1", text: "Hello" },
    { op: "insert", parent: "page", node: { type: "box", children: [{ type: "text", text: "Hello" }] } },
    { op: "set_style", id: "heading-1", styles: { fontSize: "24px", color: "#333" } },
    { op: "update_page", title: "New title" },
    { op: "delete", id: "heading-1" },
  ]) assert.equal(aiOperation.safeParse(op).success, true, JSON.stringify(op));
});

test("reject missing or unknown operation names, unexpected fields and invalid nodes", () => {
  for (const op of [
    { id: "x", text: "hello" },
    { op: "invalid", id: "x" },
    { op: "set_text", id: "x", text: "hello", unknown: true },
    { op: "delete" },
    { op: "set_style", id: "x", styles: { background: false } },
    { op: "insert", node: { type: "unknown" } },
    { op: "insert", node: { type: "text", children: [{ text: "Missing type" }] } },
  ]) assert.equal(aiOperation.safeParse(op).success, false, JSON.stringify(op));
});

test("nested boxes have a typed recursive node structure", () => {
  const doc = { type: "box", children: [{ type: "box", children: [{ type: "heading", text: "Welcome", level: 1 }] }] };
  assert.equal(aiNode.safeParse(doc).success, true);
});
