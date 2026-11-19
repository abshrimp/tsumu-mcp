# Authoring a Tsumu SiteDoc for `stage_site_doc`

Use this reference when creating a **new** site with the MCP tool. `stage_site_doc` takes a full, plain JavaScript/JSON object as `doc`, not a string, ZIP archive, HTML page or compressed `doc.json` wrapper.

**Authority:** The latest `abshrimp/tsumu` sources (`lib/types.ts`, `lib/presets.ts`, `lib/site-import-format.ts` and `skills/tsumu-site/references/site-doc.md`) define the actual format. This local reference is a compact starter. Consult current types for advanced scripts, motions, components and controls; never infer unsupported properties.

## Minimal structure

Use [minimal-site.json](minimal-site.json) as a valid editable example. It contains a hero, title, paragraph and linked button-like element, all editable.

```json
{
  "schemaVersion": 1,
  "siteName": "My new website",
  "pages": {
    "page_home": {
      "id": "page_home",
      "name": "Home",
      "slug": "",
      "title": "Home",
      "description": "Welcome",
      "children": ["node_heading"]
    }
  },
  "pageOrder": ["page_home"],
  "nodes": {
    "node_heading": {
      "id": "node_heading",
      "type": "box",
      "name": "Heading",
      "semantic": "auto",
      "text": { "content": "Welcome", "heading": 1 },
      "link": null,
      "children": [],
      "styles": { "base": { "default": { "fontSize": "48px" } } }
    }
  },
  "assets": {}
}
```

## Pages and navigation

- Every `pages` key must equal its page `id`. `pageOrder` must list existing page IDs in intended order. A regular site must have a home page (`slug: ""`).
- `children` is an array of *node IDs*, not nested node objects. All referenced nodes must exist in `nodes`, with no cycles or accidental shared parentage.
- A page is normally an editable visual page. Do not set `rawHtml` unless the user explicitly wants a raw HTML page.
- Internal link: `{"kind":"page","pageId":"page_about"}`, where `page_about` exists. External link: `{"kind":"url","url":"https://example.com","newTab":false}`; use only URLs with clear purpose.

## Nodes and styles

**Native styling path:** the editor reads `nodes[id].styles.base.default` (or a breakpoint/state override). For example:
```json
"styles": {
  "base": {
    "default": {
      "backgroundColor": "#122c25",
      "color": "#e1ff65",
      "fontSize": "64px",
      "padding": "80px 32px"
    }
  },
  "sm": {
    "default": {
      "fontSize": "36px",
      "padding": "40px 20px"
    }
  }
}
```
A top-level `style`, `css`, `className`, or a flat `styles: { backgroundColor: ... }` is **not** a Tsumu style and will not render as intended. The MCP staging tool rejects these malformed shapes. A document can otherwise pass structural validation while still containing CSS properties unsupported by browsers; visually verify the result when possible.

- Editable element node types include `box`, `image`, `divider`, `code`, `instance`, `icon`, `field`, `media`, `embed` and `list`. Do **not** use `text`, `heading` or `button` as persisted node `type` values. Those names may appear in the **different MCP editing operation schema**.
- Text is `box.text: {"content":"Hello","heading":0}`; headings use `heading: 1..6`. Containers have `text: null`. Typical required fields are `id`, `type`, `name`, `semantic`, `text`, `link`, `children`, `styles`.
- `styles` maps breakpoint -> state -> declarations, e.g. `{"base":{"default":{"display":"flex","gap":"24px"}},"sm":{"default":{"flexDirection":"column"}}}`. CSS names are **camelCase**, values are strings.
- Keep content semantic and accessible: logical headings, meaningful alt text, descriptive links and form labels, keyboard-friendly controls and readable responsive layouts.

## Images, motion and scripts

- `assets: {}` is valid for sites without locally packaged files. External image URLs may be used in image `src`; verify that they actually exist and are appropriate to use.
- The handoff tool cannot accept a separate ZIP. If a real uploaded asset must be included, provide a matching asset record with a small `dataUrl` (subject to the 12 MiB total serialized size limit) or use a justified external source. Do not fabricate `path` or storage asset IDs.
- Scripts and animations are native Tsumu editor data, not arbitrary webpage JavaScript. Their shapes can change. Only create these fields after reading the exact current `ScriptStep` / motion types, and use real IDs and correct triggers. Never present decorative animation as a functional form, or a fake call-to-action as working behavior.
- Do not embed credentials, secret API keys or private information in shareable site data.

## Checks before calling the tool

1. Confirm that the user requested a **new** site (an existing-site update belongs to `tsumu-edit-site`).
2. Check required root fields, nonempty site name, page IDs, home slug, node references, type names, style shapes, and requested pages.
3. Check responsive layouts, headings, meaningful content and navigation. Check script/motion types against the current source if used. Do not claim a visual preview without running one.
4. Pass the complete object to `stage_site_doc({doc: ...})`. Do **not** gzip or Base64-wrap it.
5. For a site-creation request, the staged site's handoff artifact is the exact `importUrl` returned by the tool. It is a private, short-lived link the requester can open to import the editable site.

Staging is temporary: one-hour expiry, 12 MiB limit; Tsumu imports the link into a **new** site and deletes the staged copy only on successful save acknowledgement.
