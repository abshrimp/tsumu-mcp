/**
 * Fail before issuing an import URL for malformed AI-generated SiteDocs.
 * The final import is still checked independently by Tsumu itself.
 */
import { checkNodeFields, checkPageFields, checkAssetFields, isDocumentId } from "./site-doc-shapes.js";

const NODE_TYPES = new Set(["box", "image", "divider", "code", "instance", "icon", "field", "media", "embed", "list"]);
const STATE = /^(?:default|hover|active|focus|custom:[a-zA-Z0-9_ -]{1,40})$/;
const CSS_NAME = /^(?:--[\w-]+|[a-zA-Z][a-zA-Z0-9]*)$/;
const WRONG_FIELDS = ["style", "css", "className", "animation", "animations", "elements"];
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

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
    if (!isDocumentId(breakpoint) || !object(states)) {
      invalid(at + "." + breakpoint, "invalid breakpoint or expected named states");
    }
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
function checkComplexity(input) {
  const stack = [{ value: input, depth: 0 }];
  const seen = new WeakSet();
  let visited = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (++visited > 400000 || depth > 80) invalid("document", "document exceeds depth or complexity limits");
    if (!value || typeof value !== "object") continue;
    if (seen.has(value)) invalid("document", "repeated or cyclic object reference");
    seen.add(value);
    const entries = Object.entries(value);
    for (const [key, item] of entries) {
      if (!Array.isArray(value) && BAD_KEYS.has(key)) invalid(key, "unsafe property name");
      stack.push({ value: item, depth: depth + 1 });
    }
  }
}
function checkChildren(children, at, nodes) {
  if (!Array.isArray(children) || children.some(id => !isDocumentId(id) || !Object.hasOwn(nodes, id)) ||
      new Set(children).size !== children.length) {
    invalid(at, "unknown, duplicate or invalid child element ID");
  }
}
function checkForest(doc) {
  const parentOf = new Map();
  const edges = new Map();
  for (const [id, node] of Object.entries(doc.nodes)) {
    checkChildren(node.children, "nodes." + id + ".children", doc.nodes);
    edges.set(id, node.children);
    for (const child of node.children) {
      if (parentOf.has(child)) invalid("nodes." + child, "element has more than one parent");
      parentOf.set(child, id);
    }
  }
  const owned = new Set(parentOf.keys());
  for (const [id, page] of Object.entries(doc.pages)) {
    checkChildren(page.children, "pages." + id + ".children", doc.nodes);
    for (const child of page.children) {
      if (owned.has(child)) invalid("pages." + id + ".children", "element belongs to multiple parents or pages");
      owned.add(child);
    }
  }
  let layer = [...edges.keys()].filter(id => !parentOf.has(id));
  let visited = 0;
  for (let depth = 1; layer.length; depth++) {
    if (depth > 256) invalid("nodes", "element hierarchy is too deep");
    visited += layer.length;
    const next = [];
    for (const id of layer) for (const child of edges.get(id)) next.push(child);
    layer = next;
  }
  if (visited !== edges.size) invalid("nodes", "cyclic element hierarchy");

  const components = doc.components ?? {};
  if (!object(components)) invalid("components", "expected a component map");
  const rootOwners = new Map();
  const dependencies = new Map();
  for (const [id, component] of Object.entries(components)) {
    if (!isDocumentId(id) || !object(component) || component.id !== id ||
        typeof component.name !== "string" || !edges.has(component.rootId) || rootOwners.has(component.rootId)) {
      invalid("components." + id, "invalid component or root element");
    }
    rootOwners.set(component.rootId, id);
    dependencies.set(id, new Set());
  }
  for (const root of rootOwners.keys()) {
    let ancestor = parentOf.get(root);
    while (ancestor) {
      if (rootOwners.has(ancestor)) invalid("components." + rootOwners.get(root), "nested component master");
      ancestor = parentOf.get(ancestor);
    }
  }
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (node.type === "instance" &&
        (typeof node.componentId !== "string" || !Object.hasOwn(components, node.componentId))) {
      invalid("nodes." + id + ".componentId", "unknown component");
    }
  }
  for (const [root, owner] of rootOwners) {
    const pending = [root];
    while (pending.length) {
      const id = pending.pop();
      const node = doc.nodes[id];
      if (node.type === "instance") dependencies.get(owner).add(node.componentId);
      pending.push(...edges.get(id));
    }
  }
  const incoming = new Map([...dependencies.keys()].map(id => [id, 0]));
  for (const targets of dependencies.values()) for (const id of targets) incoming.set(id, incoming.get(id) + 1);
  const pending = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  let processed = 0;
  while (pending.length) {
    processed++;
    for (const id of dependencies.get(pending.pop())) {
      const n = incoming.get(id) - 1;
      incoming.set(id, n);
      if (n === 0) pending.push(id);
    }
  }
  if (processed !== dependencies.size) invalid("components", "cyclic component references");
}
function checkAssetRef(ref, at, assets) {
  if (object(ref) && ref.assetId !== undefined &&
      (typeof ref.assetId !== "string" || !Object.hasOwn(assets, ref.assetId))) {
    invalid(at + ".assetId", "unknown asset");
  }
}
function checkOptions(doc) {
  for (const [id, asset] of Object.entries(doc.assets)) {
    if (!isDocumentId(id) || !object(asset) || asset.id !== id) invalid("assets." + id, "invalid asset ID");
    checkAssetFields(asset, "assets." + id, invalid);
  }
  const folders = new Set();
  if (doc.pageFolders !== undefined) {
    if (!Array.isArray(doc.pageFolders)) invalid("pageFolders", "expected a folder list");
    for (const folder of doc.pageFolders) {
      if (!object(folder) || !isDocumentId(folder.id) || typeof folder.name !== "string" || folders.has(folder.id)) {
        invalid("pageFolders", "invalid or duplicate folder");
      }
      folders.add(folder.id);
      if (folder.beforePageId !== undefined) {
        const page = doc.pages[folder.beforePageId];
        if (typeof folder.beforePageId !== "string" || !object(page) || page.folderId !== undefined) {
          invalid("pageFolders." + folder.id + ".beforePageId", "invalid folder anchor");
        }
      }
    }
  }
  for (const [id, page] of Object.entries(doc.pages)) {
    if (page.folderId !== undefined && !folders.has(page.folderId)) invalid("pages." + id + ".folderId", "unknown folder");
    checkAssetRef(page.ogImage, "pages." + id + ".ogImage", doc.assets);
    if (object(page.htmlZip) && Array.isArray(page.htmlZip.assetIds)) {
      for (const assetId of page.htmlZip.assetIds) {
        if (!Object.hasOwn(doc.assets, assetId)) invalid("pages." + id + ".htmlZip", "unknown asset");
      }
    }
  }
  for (const [id, node] of Object.entries(doc.nodes)) {
    checkAssetRef(node.image, "nodes." + id + ".image", doc.assets);
    checkAssetRef(node.media, "nodes." + id + ".media", doc.assets);
    if (object(node.media) && Array.isArray(node.media.sources)) {
      for (const source of node.media.sources) checkAssetRef(source, "nodes." + id + ".media.sources", doc.assets);
    }
  }
  for (const key of ["favicon", "appleTouchIcon", "ogImage"]) {
    checkAssetRef(doc[key], key, doc.assets);
  }
  if (object(doc.pwa)) checkAssetRef(doc.pwa.icon, "pwa.icon", doc.assets);
}

export function checkStagedSiteDoc(doc) {
  if (!object(doc) || doc.schemaVersion !== 1 || typeof doc.siteName !== "string" ||
      !doc.siteName.trim() || !object(doc.pages) || !object(doc.nodes) ||
      !object(doc.assets) || !Array.isArray(doc.pageOrder) || doc.pageOrder.length === 0) {
    throw new Error("Expected a complete Tsumu SiteDoc (schemaVersion 1), not HTML or a partial page");
  }
  if (doc.pageOrder.length > 500 || Object.keys(doc.pages).length > 500 ||
      Object.keys(doc.nodes).length > 25000 || Object.keys(doc.assets).length > 1000) {
    invalid("pages/nodes/assets", "document exceeds structural limits");
  }
  checkComplexity(doc);
  const seenPages = new Set();
  for (const id of doc.pageOrder) {
    const page = doc.pages[id];
    if (!isDocumentId(id) || seenPages.has(id) || !object(page)) {
      invalid("pages." + String(id), "unknown, duplicate or invalid page ID");
    }
    seenPages.add(id);
  }
  for (const [id, page] of Object.entries(doc.pages)) {
    if (!isDocumentId(id) || !object(page) || page.id !== id ||
        typeof page.slug !== "string" || typeof page.name !== "string" ||
        typeof page.title !== "string" || typeof page.description !== "string" ||
        !Array.isArray(page.children)) invalid("pages." + id, "invalid page fields");
    checkPageFields(page, "pages." + id, invalid, checkStyles);
  }
  let styleDeclarations = 0;
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (!isDocumentId(id) || !object(node) || node.id !== id || !NODE_TYPES.has(node.type) ||
        typeof node.name !== "string" || !Array.isArray(node.children)) {
      invalid("nodes." + id, "invalid editable node");
    }
    for (const field of WRONG_FIELDS) {
      if (field in node) invalid("nodes." + id + "." + field, "unsupported node field; use styles.base.default or native Tsumu fields");
    }
    checkNodeFields(node, "nodes." + id, invalid);
    styleDeclarations += checkStyles(node.styles, "nodes." + id + ".styles");
    if (node.darkStyles !== undefined) checkStyles(node.darkStyles, "nodes." + id + ".darkStyles");
    if (node.text != null &&
        (!object(node.text) || typeof node.text.content !== "string" ||
         !Number.isInteger(node.text.heading) || node.text.heading < 0 || node.text.heading > 6)) {
      invalid("nodes." + id + ".text", "headings and text use { content, heading: 0..6 } on box nodes");
    }
  }
  checkForest(doc);
  checkOptions(doc);
  if (Object.keys(doc.nodes).length >= 4 && styleDeclarations === 0) {
    invalid("nodes.*.styles", "multiple editable elements have no CSS declarations, so the requested visual design will not appear");
  }
  return { nodeCount: Object.keys(doc.nodes).length, styleDeclarations };
}
