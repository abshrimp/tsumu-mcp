import { z } from "zod";

/** Keep in sync with Tsumu's AiOp model. No arbitrary untyped operation payloads. */
const identifier = z.string().min(1).max(100);
const cssValue = z.union([z.string().max(4000), z.number().finite(), z.null()]);
export const styles = z.union([
  z.string().max(12000),
  z.record(z.string().regex(/^[A-Za-z-]{1,80}$/), cssValue),
]);
const link = z.strictObject({
  url: z.string().max(4096).optional(),
  pageId: identifier.optional(),
  newTab: z.boolean().optional(),
});
const linkOrNull = z.union([link, z.null()]);
const responsiveItem = z.strictObject({ breakpoint: identifier, styles });
const place = {
  parent: identifier.optional(),
  index: z.number().int().min(0).max(100000).optional(),
  after: identifier.optional(),
  before: identifier.optional(),
};
const nonEmpty = z.string().min(1).max(200);
export const aiNode = z.lazy(() => z.strictObject({
  type: z.enum(["box", "text", "heading", "button", "image", "divider", "code"]),
  ref: identifier.optional(),
  name: z.string().max(150).optional(),
  text: z.string().max(200000).optional(),
  level: z.number().int().min(1).max(6).optional(),
  tag: z.enum(["section", "header", "footer", "nav", "main", "article", "div", "form", "span"]).optional(),
  styles: styles.optional(),
  responsive: z.union([
    z.record(z.string(), styles),
    z.array(responsiveItem).max(30),
  ]).optional(),
  hover: styles.optional(),
  link: linkOrNull.optional(),
  src: z.string().max(4096).optional(),
  alt: z.string().max(4000).optional(),
  html: z.string().max(200000).optional(),
  children: z.array(aiNode).max(200).optional(),
}));

export const aiOperation = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("set_style"), id: identifier, styles, breakpoint: identifier.optional(), state: z.enum(["default", "hover", "active", "focus"]).optional() }),
  z.strictObject({ op: z.literal("set_text"), id: identifier, text: z.string().max(200000), level: z.number().int().min(0).max(6).optional() }),
  z.strictObject({ op: z.literal("insert"), node: aiNode, ...place }),
  z.strictObject({ op: z.literal("move"), id: identifier, ...place }),
  z.strictObject({ op: z.literal("delete"), id: identifier }),
  z.strictObject({ op: z.literal("duplicate"), id: identifier, newId: identifier.optional(), ref: identifier.optional() }),
  z.strictObject({ op: z.literal("rename"), id: identifier, name: nonEmpty }),
  z.strictObject({ op: z.literal("set_link"), id: identifier, link: linkOrNull }),
  z.strictObject({ op: z.literal("set_image"), id: identifier, src: z.string().max(4096).optional(), alt: z.string().max(4000).optional() }),
  z.strictObject({ op: z.literal("set_hidden"), id: identifier, breakpoints: z.array(identifier).max(30) }),
  z.strictObject({ op: z.literal("update_page"), title: z.string().max(200).optional(), description: z.string().max(12000).optional(), name: nonEmpty.optional() }),
]);

export const pageRevision = z.string().regex(/^[a-f0-9]{64}$/);
export const requestId = z.string().min(8).max(80).regex(/^[\w-]+$/);

export const editContext = {
  pageId: identifier,
  expectedRevision: pageRevision,
  requestId,
};
