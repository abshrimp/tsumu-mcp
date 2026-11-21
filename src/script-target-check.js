/**
 * SiteDoc script "target" values are HTML id attributes (node.attrId), not
 * SiteDoc node keys. Detect broken references before giving an AI an import URL.
 * No edits are made to the supplied document.
 */
const ELEMENT_STEPS = new Set([
  "show", "hide", "toggle", "scroll-to", "set-state", "set-value", "set-enabled",
]);
const SELF = "@self";

function visibleNodes(doc, roots) {
  const seen = new Set();
  const pending = [...roots];
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    const node = doc.nodes[id];
    if (!node) continue;
    seen.add(id);
    pending.push(...node.children);
    if (node.type === "instance") {
      const master = doc.components?.[node.componentId]?.rootId;
      if (master) pending.push(master);
    }
  }
  return seen;
}

function scope(doc, nodeIds) {
  const attrs = new Set();
  for (const id of nodeIds) {
    const attr = doc.nodes[id]?.attrId;
    if (typeof attr === "string" && attr.trim()) attrs.add(attr);
  }
  return { nodes: nodeIds, attrs };
}

function checkScripts(doc, scripts, where, ownerIsElement, current, invalid) {
  for (let s = 0; s < (scripts?.length ?? 0); s++) {
    const stack = [{ steps: scripts[s].steps, path: where + "[" + s + "].steps" }];
    while (stack.length) {
      const { steps, path } = stack.pop();
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const at = path + "[" + i + "]";
        const check = (value, location) => {
          if (value === SELF && ownerIsElement) return;
          if (typeof value === "string" && value && current.attrs.has(value)) return;
          if (value === SELF) invalid(location, "@self requires a script attached to an element, not pageScripts");
          if (!value) invalid(location, "select a target node and use its nonempty HTML attrId (not its SiteDoc node id)");
          const known = typeof value === "string" && current.nodes.has(value) ? doc.nodes[value] : null;
          if (known) invalid(location,
            known.attrId
              ? "target uses SiteDoc node id " + JSON.stringify(value) +
                "; use its HTML attrId " + JSON.stringify(known.attrId) + " instead"
              : "target uses SiteDoc node id " + JSON.stringify(value) +
                "; assign nodes." + value + ".attrId and use that HTML id as target");
          invalid(location,
            "no element on this script's page or in its component has HTML attrId " + JSON.stringify(value) +
            "; use a unique attrId on a reachable target element");
        };
        if (ELEMENT_STEPS.has(step.kind)) check(step.target, at + ".target");
        if (step.kind === "if") {
          const conditions = [step.cond, ...(step.conditions ?? [])];
          for (let c = 0; c < conditions.length; c++) {
            const cond = conditions[c];
            if (cond.subject !== "var") {
              check(cond.target, at + (c === 0 ? ".cond.target" : ".conditions[" + (c - 1) + "].target"));
            }
          }
          if (step.else) stack.push({ steps: step.else, path: at + ".else" });
          stack.push({ steps: step.then, path: at + ".then" });
        } else if (step.kind === "repeat" || step.kind === "for-each") {
          stack.push({ steps: step.then, path: at + ".then" });
        }
      }
    }
  }
}

export function checkScriptTargetReferences(doc, invalid) {
  const masters = new Map();
  const componentOwner = new Map();
  for (const [componentId, component] of Object.entries(doc.components ?? {})) {
    const selected = scope(doc, visibleNodes(doc, [component.rootId]));
    masters.set(componentId, selected);
    for (const id of selected.nodes) {
      // A nested component owns its own script scope, even inside other masters.
      if (!componentOwner.has(id)) componentOwner.set(id, componentId);
    }
  }
  for (const [componentId, component] of Object.entries(doc.components ?? {})) {
    const selected = masters.get(componentId);
    const visited = new Set();
    // Check only the master's actual tree, not nested component masters.
    const pending = [component.rootId];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      const node = doc.nodes[id];
      if (!node) continue;
      if (node.scripts) checkScripts(doc, node.scripts, "nodes." + id + ".scripts", true, selected, invalid);
      pending.push(...node.children);
    }
  }
  const checked = new Set();
  for (const [pageId, page] of Object.entries(doc.pages)) {
    const selected = scope(doc, visibleNodes(doc, page.children));
    if (page.pageScripts) checkScripts(doc, page.pageScripts, "pages." + pageId + ".pageScripts", false, selected, invalid);
    for (const id of selected.nodes) {
      if (componentOwner.has(id) || checked.has(id)) continue;
      checked.add(id);
      const node = doc.nodes[id];
      if (node.scripts) checkScripts(doc, node.scripts, "nodes." + id + ".scripts", true, selected, invalid);
    }
  }
}
