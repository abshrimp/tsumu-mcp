/**
 * Fail fast on common AI-generated SiteDoc mistakes before charging the draft
 * quota. Tsumu's full importer remains the authoritative validator.
 */
const NODE_TYPES = new Set(["box", "image", "divider", "code", "instance", "icon", "field", "media", "embed", "list"]);
const STATE = /^(?:default|hover|active|focus|custom:[a-zA-Z0-9_ -]{1,40})$/;
const CSS_NAME = /^(?:--[\w-]+|[a-zA-Z][a-zA-Z0-9]*)$/;
const WRONG_FIELDS = ["style", "css", "className", "animation", "animations", "elements"];

function object(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function invalid(at, reason) {
  throw new Error("Invalid SiteDoc at " + at + ": " + reason +
    ". Read get_site_doc_spec before building the document.");
}
function checkStyles(styles, at) {
  if (!object(styles)) invalid(at, "expected styles grouped by breakpoint and state");
  let count = 0;
  for (const [breakpoint, states] of Object.entries(styles)) {
    if (!object(states)) invalid(at + "." + breakpoint, "expected named states such as default");
    for (const [state, declarations] of Object.entries(states)) {
      if (!STATE.test(state) || !object(declarations)) {
        invalid(at + "." + breakpoint + "." + state, "expected a CSS declaration object in a valid state");
      }
      for (const [property, value] of Object.entries(declarations)) {
        if (!CSS_NAME.test(property) || typeof value !== "string" ||
            /[{}]/.test(value) || /<\/style\b/i.test(value)) {
          invalid(at + "." + breakpoint + "." + state + "." + property,
            "use camelCase CSS property names and string values without CSS rules");
        }
        count++;
      }
    }
  }
  return count;
}
export function checkStagedSiteDoc(doc) {
  if (!object(doc) || doc.schemaVersion !== 1 || typeof doc.siteName !== "string" ||
      !doc.siteName.trim() || !object(doc.pages) || !object(doc.nodes) ||
      !object(doc.assets) || !Array.isArray(doc.pageOrder) || doc.pageOrder.length === 0) {
    throw new Error("Expected a complete Tsumu SiteDoc (schemaVersion 1), not HTML or a partial page");
  }
  if (doc.pageOrder.length > 500 || Object.keys(doc.nodes).length > 25000) {
    invalid("pages/nodes", "document exceeds structural limits");
  }
  const seenPages = new Set();
  for (const id of doc.pageOrder) {
    const page = doc.pages[id];
    if (typeof id !== "string" || seenPages.has(id) || !object(page) ||
        page.id !== id || typeof page.slug !== "string" || typeof page.name !== "string" ||
        typeof page.title !== "string" || typeof page.description !== "string" ||
        !Array.isArray(page.children)) invalid("pages." + String(id), "invalid page ID or required fields");
    seenPages.add(id);
    for (const child of page.children) {
      if (typeof child !== "string" || !Object.hasOwn(doc.nodes, child)) {
        invalid("pages." + id + ".children", "unknown node " + String(child));
      }
    }
  }
  let styleDeclarations = 0;
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (!object(node) || node.id !== id || !NODE_TYPES.has(node.type) ||
        typeof node.name !== "string" || !Array.isArray(node.children)) {
      invalid("nodes." + id, "invalid editable node");
    }
    for (const field of WRONG_FIELDS) {
      if (field in node) invalid("nodes." + id + "." + field, "unsupported node field; use styles.base.default or native Tsumu fields");
    }
    for (const child of node.children) {
      if (typeof child !== "string" || !Object.hasOwn(doc.nodes, child)) {
        invalid("nodes." + id + ".children", "unknown node " + String(child));
      }
    }
    styleDeclarations += checkStyles(node.styles, "nodes." + id + ".styles");
    if (node.text != null &&
        (!object(node.text) || typeof node.text.content !== "string" ||
         !Number.isInteger(node.text.heading) || node.text.heading < 0 || node.text.heading > 6)) {
      invalid("nodes." + id + ".text", "headings and text use { content, heading: 0..6 } on box nodes");
    }
  }
  if (Object.keys(doc.nodes).length >= 4 && styleDeclarations === 0) {
    invalid("nodes.*.styles", "multiple editable elements have no CSS declarations, so the requested visual design will not appear");
  }
  return { nodeCount: Object.keys(doc.nodes).length, styleDeclarations };
}
