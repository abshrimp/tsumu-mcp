// Match the saved SiteDoc field shapes in Tsumu's lib/doc-tree.ts,
// lib/document-value-shapes.ts and lib/document-validation.ts.
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const str = value => typeof value === "string";
const bool = value => typeof value === "boolean";
const finite = value => typeof value === "number" && Number.isFinite(value);
const nonnegative = value => finite(value) && value >= 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const optional = (value, check) => value === undefined || check(value);
const nullable = (value, check) => value == null || check(value);
const arrayOf = (value, check) => Array.isArray(value) && value.every(check);
const oneOf = (value, choices) => str(value) && choices.includes(value);
const stringMap = value => object(value) && Object.values(value).every(str);
const documentId = value => str(value) && /^[A-Za-z0-9_-]{1,200}$/.test(value) &&
  !["__proto__", "prototype", "constructor"].includes(value) && !Object.hasOwn(Object.prototype, value);

const semantics = ["auto", "form", "button", "div", "section", "header", "footer", "nav", "main", "article", "span", "custom"];
const scriptOps = ["eq", "contains", "contains-any", "starts-with", "ends-with", "gt", "gte", "lt", "lte", "empty", "has-key", "in"];
const finiteOrString = value => finite(value) || str(value);
const validImageRef = value => object(value) && optional(value.url, str) && optional(value.assetId, str);
const validCondition = (value, joined = false) => object(value) &&
  oneOf(value.subject, ["value", "checked", "visible", "hovered", "var"]) &&
  str(value.target) && optional(value.left, str) && optional(value.op, x => oneOf(x, scriptOps)) &&
  optional(value.value, str) && optional(value.not, bool) && (!joined || bool(value.and));
const validFilter = value => object(value) && str(value.field) &&
  oneOf(value.op, scriptOps) && str(value.value) &&
  optional(value.not, bool) && optional(value.and, bool);
const validHeader = value => object(value) && str(value.name) && str(value.value);

function validTransform(value) {
  if (!object(value)) return false;
  switch (value.kind) {
    case "field": return str(value.key);
    case "length": case "stringify": case "parse": return true;
    case "fallback": return str(value.text) && oneOf(value.when, ["missing", "nullish"]);
    case "math": return oneOf(value.operation, ["add", "subtract", "multiply", "divide", "remainder"]) &&
      finiteOrString(value.operand) && oneOf(value.operandType, ["number", "variable"]);
    case "split": case "join": return str(value.separator);
    case "replace": return str(value.find) && str(value.replacement) && bool(value.regex);
    case "sort": return str(value.field) && oneOf(value.direction, ["asc", "desc"]);
    default: return false;
  }
}

function validSteps(steps, depth, count) {
  if (!Array.isArray(steps) || depth > 64) return false;
  for (const step of steps) {
    if (!object(step) || !str(step.id) || !step.id || ++count.value > 100000) return false;
    let valid = false;
    switch (step.kind) {
      case "show": case "hide": case "toggle": case "scroll-to":
        valid = str(step.target); break;
      case "set-state":
        valid = str(step.target) && str(step.state); break;
      case "open-page":
        valid = str(step.pageId) && optional(step.newTab, bool); break;
      case "open-url":
        valid = str(step.url) && optional(step.newTab, bool); break;
      case "dialog":
        valid = oneOf(step.mode, ["alert", "confirm", "prompt"]) && str(step.message) &&
          optional(step.into, str) && optional(step.defaultValue, str); break;
      case "set-value":
        valid = str(step.target) && str(step.value); break;
      case "set-enabled":
        valid = str(step.target) && oneOf(step.op, ["enable", "disable", "toggle"]); break;
      case "list-display":
        valid = oneOf(step.mode, ["filter", "sort", "clear"]) && str(step.array) &&
          str(step.field) && oneOf(step.op, scriptOps) && str(step.value) &&
          optional(step.not, bool) &&
          optional(step.or, value => arrayOf(value, validFilter)) &&
          optional(step.no, finite) && optional(step.join, value => oneOf(value, ["and", "or"])) &&
          oneOf(step.dir, ["asc", "desc"]); break;
      case "store-save":
        valid = str(step.key) && str(step.value) && optional(step.shared, bool); break;
      case "store-load":
        valid = str(step.key) && str(step.into) && optional(step.shared, bool); break;
      case "set-list-item":
        valid = str(step.list) && str(step.key) && str(step.value); break;
      case "remove-list-item":
        valid = str(step.list) && oneOf(step.mode, ["value", "key"]) && str(step.value); break;
      case "break-loop":
        valid = true; break;
      case "set-var":
        valid = str(step.value) && str(step.into); break;
      case "transform":
        valid = str(step.source) && str(step.into) && validTransform(step.transform); break;
      case "copy":
        valid = str(step.value); break;
      case "wait":
        valid = finiteOrString(step.seconds); break;
      case "repeat":
        valid = finiteOrString(step.times) && validSteps(step.then, depth + 1, count); break;
      case "for-each":
        valid = str(step.array) && validSteps(step.then, depth + 1, count); break;
      case "fetch":
        valid = str(step.url) && optional(step.method, value => oneOf(value, ["GET", "POST", "PUT", "PATCH", "DELETE"])) &&
          optional(step.headers, value => arrayOf(value, validHeader)) &&
          optional(step.body, str) && optional(step.as, str) &&
          optional(step.preview, value => object(value) && optional(value.fetchedAt, finite) &&
            optional(value.totals, totals => object(totals) && Object.values(totals).every(finite))) &&
          Object.keys(step).every(key => ["id", "kind", "url", "method", "headers", "body", "as", "preview"].includes(key)); break;
      case "if":
        valid = validCondition(step.cond) &&
          optional(step.conditions, value => arrayOf(value, condition => validCondition(condition, true))) &&
          validSteps(step.then, depth + 1, count) &&
          optional(step.else, value => validSteps(value, depth + 1, count)); break;
    }
    if (!valid) return false;
  }
  return true;
}

function validScripts(value) {
  if (!Array.isArray(value)) return false;
  const count = { value: 0 };
  return value.every(script => object(script) && str(script.id) && !!script.id &&
    oneOf(script.trigger, ["click", "hover-start", "hover-end", "change", "load", "in-view"]) &&
    optional(script.changeVariable, str) && optional(script.keepOnShown, bool) &&
    validSteps(script.steps, 0, count));
}

function validField(value) {
  if (!object(value) || !oneOf(value.kind,
    ["input", "textarea", "select", "checkbox", "radio", "file", "submit"])) return false;
  return optional(value.inputType, x => oneOf(x,
    ["text", "email", "password", "number", "tel", "url", "search", "date", "time", "datetime-local", "month", "week", "color", "range"])) &&
    ["name", "submitValue", "label", "defaultValue", "placeholder", "group", "min", "max", "step", "accept"]
      .every(key => optional(value[key], str)) &&
    ["checked", "disabled", "required", "multiple"].every(key => optional(value[key], bool)) &&
    optional(value.maxLength, integer) && optional(value.rows, integer) &&
    nullable(value.options, items => arrayOf(items, option => object(option) && str(option.label) && str(option.value)));
}

function validMotion(value) {
  return object(value) && str(value.id) &&
    oneOf(value.trigger, ["state", "hover", "active", "load", "in-view"]) &&
    finite(value.duration) && finite(value.delay) && str(value.easing) &&
    optional(value.property, str) && optional(value.keyframes, str) &&
    optional(value.customKeyframes, str) && optional(value.repeat, finite) &&
    optional(value.direction, v => oneOf(v, ["normal", "reverse", "alternate"])) &&
    optional(value.fillMode, v => oneOf(v, ["both", "forwards", "backwards", "none"]));
}

const nodeChecks = {
  customTag: str, componentId: str, customCss: str, htmlClass: str, htmlAttrs: stringMap,
  motions: value => arrayOf(value, validMotion),
  hiddenOn: value => arrayOf(value, documentId), locked: bool, attrId: str,
  link: value => nullable(value, v => object(v) && oneOf(v.kind, ["url", "page"]) &&
    optional(v.url, str) && optional(v.pageId, str) && optional(v.newTab, bool)),
  image: value => nullable(value, v => object(v) && str(v.src) && str(v.alt) &&
    finite(v.width) && finite(v.height) && optional(v.assetId, str) &&
    optional(v.assetSuffix, str) && optional(v.priority, bool) && optional(v.crispShadow, bool)),
  media: value => nullable(value, v => object(v) && oneOf(v.kind, ["video", "audio"]) &&
    str(v.src) && optional(v.assetId, str) && optional(v.assetSuffix, str) &&
    optional(v.sources, sources => arrayOf(sources, s => object(s) && str(s.src) &&
      optional(s.assetId, str) && optional(s.assetSuffix, str) &&
      optional(s.type, str) && optional(s.media, str))) &&
    ["loop", "autoplay", "muted"].every(key => optional(v[key], bool))),
  embed: value => nullable(value, v => object(v) && oneOf(v.kind, ["youtube", "map", "url"]) && str(v.src)),
  icon: value => nullable(value, v => object(v) && str(v.name) && str(v.svg)),
  code: value => nullable(value, v => object(v) && str(v.html)),
  field: value => nullable(value, validField),
  list: value => nullable(value, v => object(v) &&
    optional(v.from, str) && optional(v.limit, nonnegative)),
  scripts: validScripts,
};

export function checkNodeFields(node, at, invalid) {
  if (!oneOf(node.semantic, semantics)) {
    invalid(at + ".semantic", "expected a Tsumu semantic element type (e.g. auto, section, div)");
  }
  for (const [field, check] of Object.entries(nodeChecks)) {
    if (node[field] !== undefined && !check(node[field])) {
      invalid(at + "." + field, "invalid Tsumu element settings");
    }
  }
}

const pageChecks = {
  query: str, lang: str, htmlBackground: str, folderId: str,
  customTopHtml: str, customEndHtml: str, redirectTo: str, rewriteTo: str,
  titlePending: bool, noindex: bool, unpublished: bool,
  rawHtml: value => nullable(value, str),
  htmlZip: value => object(value) && str(value.path) && value.path.length <= 600 &&
    arrayOf(value.assetIds, id => str(id) && id.length > 0) && value.assetIds.length <= 200,
  ogImage: value => nullable(value, validImageRef),
  pageScripts: validScripts,
};

export function checkPageFields(page, at, invalid, checkStyles) {
  for (const [field, check] of Object.entries(pageChecks)) {
    if (page[field] !== undefined && !check(page[field])) invalid(at + "." + field, "invalid page setting");
  }
  if ([page.rawHtml, page.redirectTo, page.rewriteTo].filter(x => x != null).length > 1) {
    invalid(at, "raw HTML, redirects and rewrites are mutually exclusive");
  }
  if (page.bodyStyles != null) checkStyles(page.bodyStyles, at + ".bodyStyles");
  if (page.bodyDarkStyles != null) checkStyles(page.bodyDarkStyles, at + ".bodyDarkStyles");
}

export function checkAssetFields(asset, at, invalid) {
  if (!object(asset) || !str(asset.name) || !nonnegative(asset.width) || !nonnegative(asset.height) ||
      !optional(asset.bytes, integer) || !optional(asset.svgFilter, bool) ||
      !optional(asset.path, str) || !optional(asset.dataUrl, str) ||
      !optional(asset.mimeType, str)) invalid(at, "invalid asset metadata");
  if (asset.dataUrl != null && !/^data:[^,]*,/i.test(asset.dataUrl)) invalid(at + ".dataUrl", "expected an embedded data URL");
}

export function isDocumentId(value) { return documentId(value); }
