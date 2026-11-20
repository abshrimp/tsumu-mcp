---
name: tsumu-build-site
description: Create a NEW editable Tsumu website or landing page from scratch, including multi-page, responsive and animated designs, then automatically give the user a one-time Tsumu import link. Not for changes to an existing site.
---

# Create a new Tsumu website

Use when the user asks to **make a new website** in Tsumu. The deliverable is a real, editable Tsumu site, **not** a design description, screenshot, HTML mockup or empty site.

## Deliverable: a private Tsumu import link

For a user-requested new site, the successful result of `stage_site_doc` includes an `importUrl`. This is the handoff artifact the requester uses to open the generated site in Tsumu. Include that exact link with a brief description of what was built; no extra request for the link is necessary. The link is private and should not be copied to logs, unrelated contexts or third-party services. Never invent or reconstruct it.

A staged link is **not** proof of import, publication or deployment. Do not claim those actions have occurred.

## Choose the workflow

- **Create a new site:** use `stage_site_doc` directly, even if no existing site is paired. The user can authorize **new-site creation only** in the MCP OAuth screen without a site connection code. An existing paired-site grant may also stage a new site.
- **Edit the user's existing site instead:** activate `tsumu-edit-site` and use the paired editor tools. Do **not** stage a copy or overwrite the existing site.
- **No staging tool or no successful authorization:** do not fabricate a URL. If artifact creation is available, produce a valid downloadable `doc.json`; otherwise explain the missing capability and what can be done.
- `create_site` is for creating an empty browser-local site in an already paired editor. It does not upload a full generated design and requires pairing the new site again. **Do not use it as a substitute for `stage_site_doc`.**

## Two-pass creation: design freely, then convert to Tsumu

**Phase 1 — create an original website concept before working in the SiteDoc format.** Treat the user's request as a website design brief, not an instruction to reskin a sample JSON document.

1. Decide the site's purpose, audience, key message, pages, content priorities and primary user action. For vague requests such as "create a nice website", choose a distinctive, plausible concept independently rather than defaulting to the sample portfolio or asking unnecessary questions. Do not invent real addresses, testimonials, product claims or prices.
2. **Design the website as if Tsumu's node schema did not exist.** Work out an original information architecture, page-by-page content, section compositions, hierarchy, typography, colors, imagery or graphic elements, spacing and responsive behavior. Avoid mechanically repeating a generic hero/features/testimonials/contact template.
3. When tools and time permit, draft the complete design as a standalone HTML/CSS prototype (and clear interaction notes) to explore layout freely. Otherwise prepare an equally specific page and component blueprint. This is an **intermediate design artifact**, not the final deliverable or a claim that Tsumu can import arbitrary HTML through `stage_site_doc`. Do not require a live preview if none is available.
4. Critique the draft against the brief: does it have a recognizable visual identity, credible content, purposeful sections, a clear user journey and a mobile layout? Refine it *before* consulting example SiteDoc layouts.

**Phase 2 — translate that design into a native, editable Tsumu SiteDoc.** Only now consult `get_site_doc_spec`, the schema guide and the minimal example to learn the **valid data shapes**, not to decide how the site should look. Rebuild the designed pages and layouts using Tsumu's supported native elements, styles, assets and interactions. Preserve the intermediate design's distinct compositions, typography, spacing, content and responsive intentions rather than collapsing it into a recolored example. If a detail is unsupported, adapt it to the closest valid editable representation or disclose the limitation; never invent schema fields.

**Originality check:** Compare the converted SiteDoc with the Phase 1 design before staging. If the final site is essentially the bundled example with changed words, colors or images, the conversion has failed: redesign the structure and composition. If the user explicitly requests a specific template, follow that request instead.

## Convert the original design into SiteDoc

**Before constructing any SiteDoc:** call the read-only MCP tool `get_site_doc_spec` and inspect both its `guide` and `example`. Do this **after planning the original design but before creating any SiteDoc pages, nodes, styles, scripts or the first `stage_site_doc` attempt**. The reference is available with a new-site-only OAuth grant. Do not skip it just because the Skill text was loaded; some MCP clients do not fetch references automatically. If the spec tool is unavailable, read `references/site-doc.md` and `references/minimal-site.json` instead. Never guess data shapes.

1. Translate the Phase 1 website's page map, content and compositions into SiteDoc. **Do not start with the example JSON and replace its copy or palette.** The guide and examples describe valid properties and relationships only. For advanced features consult the current Tsumu `lib/types.ts`, `lib/presets.ts`, `lib/site-import-format.ts` and `skills/tsumu/references/site-doc.md` when accessible.
2. Construct a complete `SiteDoc` **object** (not a JSON string, HTML page or compressed file). Required fields: `schemaVersion: 1`, nonempty `siteName`, `pages`, `pageOrder`, `nodes`, `assets`. The homepage has `slug: ""`. Page and node `children` refer to node IDs; nodes are editable `box`, `image`, etc. Text and headings use `box.text`, not a made-up `heading` node.
3. Create meaningful native page layouts matching the designed structure. Give nodes suitable semantic labels, styles and responsive overrides. Preserve actual hierarchy, spacing, typographic contrast, visual accents and section variation from Phase 1. Check navigation targets, alt text, contrast and mobile behavior. Avoid broken assets, empty links, placeholder content and off-screen elements.
4. If the design includes animations, scripts, components or form behavior, consult the **exact current type definitions** and implement only supported structures. Do not invent motion or script properties or describe an inert button as functional.
5. `stage_site_doc` accepts only the complete SiteDoc as `doc` (up to **12 MiB** of serialized JSON). It does **not** accept the Phase 1 HTML prototype, ZIPs or separate binary assets. Use `assets: {}` where possible, verified external imagery where suitable, or small embedded `dataUrl` assets within the limit. Do not invent Tsumu storage paths.
6. Review the resulting SiteDoc against the original design, not against the sample's aesthetics. Ensure it remains fully editable and structurally valid; if the conversion loses distinctive layout or content, improve the native element hierarchy before staging.

## Verify and deliver

- Before staging, compare the final pages to the Phase 1 design and confirm they are a faithful, independently composed website, not a reskinned minimal example. Keep the design intermediate private unless the user asks for it; deliver the SiteDoc or import link as the finished result.
- Before staging, ensure every visible design declaration is placed at `nodes[id].styles.base.default` or the relevant responsive override, not a made-up `style`, `css` or `className` field. The actual CSS declaration values must be strings. Check IDs, references, acyclic trees, and the import rules. Check the page hierarchy, responsiveness and requested interactions to the extent tools allow. Do not say you previewed it unless you actually did.
- Call `stage_site_doc({ doc: <complete SiteDoc> })`; use `editorOrigin` only when the user requests a specific self-hosted Tsumu installation.
- A successful new-site handoff includes the tool's exact `importUrl` as a clickable link for the requester, plus a brief explanation that opening it imports a new editable site. The link is not a published-site URL.
- If it fails, state the actual error and avoid claiming that the site was saved. Do not replace a failed tool action with an invented link or silently switch to an existing site.
- The link holds a private access token in its URL fragment, expires after **one hour** and is consumed **after Tsumu confirms successful import**. Do not disclose it to others. Failed imports may be retried after the temporary five-minute claim lease expires.

**Handoff example (illustrative only):** "The editable café site is staged for import. The private Tsumu import link is available for the next hour." The actual handoff includes the real tool-generated link when staging succeeds.
