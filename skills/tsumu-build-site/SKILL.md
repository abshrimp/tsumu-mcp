---
name: tsumu-build-site
description: Create a NEW editable Tsumu website, landing page, portfolio, or multi-page site from scratch. Use for requests such as "Tsumuでサイトを作って", "Tsumuでホームページを作成して", "build a website in Tsumu", or website creation when Tsumu is the selected builder. Read get_site_doc_spec, stage the complete SiteDoc with stage_site_doc, and provide the exact private importUrl. Do not use for adding pages to an existing site, editing a paired site, or reviewing a design; use tsumu-edit-site or tsumu-best-practices.
license: MIT
compatibility: Requires an OAuth-authorized Tsumu MCP connection to https://mcp.tsumu.ebii.net/mcp for SiteDoc staging.
metadata:
  author: abshrimp
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

## Build the editable document

**Before authoring any SiteDoc:** call the read-only MCP tool `get_site_doc_spec` and inspect both its `guide` and `example`. Do this **before** creating pages, nodes, styles, scripts, or the first `stage_site_doc` attempt. The returned reference is available even with a new-site-only OAuth grant. Do not skip this step just because the Skills document was loaded; many MCP clients do not automatically fetch skill reference files. If the spec tool is unavailable, read the bundled `references/site-doc.md` and `references/minimal-site.json` instead. Do not guess data shapes.

1. Interpret the user's brief: site purpose, audience, language, sections/pages, tone and required behavior. Make reasonable design decisions for unspecified details; ask only if a missing fact would fundamentally change the result. Do not invent real business contact details, product claims or testimonials.
2. Plan a coherent layout: navigation, recognizable visual hierarchy, restrained color/typography system, useful content, spacing, and mobile responsiveness. For a request for motion or interactivity, implement it using actual Tsumu-supported fields, not merely describe it.
3. Use the guide and example returned by `get_site_doc_spec` (or [schema notes](references/site-doc.md) and [working example](references/minimal-site.json) if offline) as the structure of your document. They are a starting point, not a license to output only a single placeholder heading. The Tsumu project's current `lib/types.ts`, `lib/presets.ts`, `lib/site-import-format.ts` and `skills/tsumu-site/references/site-doc.md` are authoritative when accessible.
4. Construct a complete `SiteDoc` **object** (not a JSON string or compressed file). Required root fields: `schemaVersion: 1`, nonempty `siteName`, `pages`, `pageOrder`, `nodes`, `assets`. A home page has `slug: ""`. Page children and element children refer to node IDs; nodes are editable `box`, `image`, etc. Text and headings use `box.text` rather than a made-up `heading` node.
5. Use native editable elements whenever possible. For page links, check referenced page IDs. Ensure labels, headings, alt text, responsive overrides and basic contrast work. Avoid broken assets, empty navigation items, placeholder copy and off-screen content.
6. If adding animations, scripts, components or form behavior, consult the **exact current type definitions** and build valid records. Do not invent motion or script keys or promise live functionality where only a static element was created. A gracefully working simpler interaction is better than invalid complex data.
7. `stage_site_doc` accepts only a full `SiteDoc` as `doc` (up to **12 MiB** of serialized JSON). It does **not** accept ZIPs or separate binary assets. Use `assets: {}` when possible, external images where suitable, or small embedded `dataUrl` assets within the limit. Do not invent Tsumu storage paths.

## Verify and deliver

- Before staging, ensure every visible design declaration is placed at `nodes[id].styles.base.default` or the relevant responsive override, not a made-up `style`, `css` or `className` field. The actual CSS declaration values must be strings. Check IDs, references, acyclic trees, and the import rules. Check the page hierarchy, responsiveness and requested interactions to the extent tools allow. Do not say you previewed it unless you actually did.
- Call `stage_site_doc({ doc: <complete SiteDoc> })`; use `editorOrigin` only when the user requests a specific self-hosted Tsumu installation.
- A successful new-site handoff includes the tool's exact `importUrl` as a clickable link for the requester, plus a brief explanation that opening it imports a new editable site. The link is not a published-site URL.
- If it fails, state the actual error and avoid claiming that the site was saved. Do not replace a failed tool action with an invented link or silently switch to an existing site.
- The link holds a private access token in its URL fragment, expires after **one hour** and is consumed **after Tsumu confirms successful import**. Do not disclose it to others. Failed imports may be retried after the temporary five-minute claim lease expires.

**Handoff example (illustrative only):** "The editable café site is staged for import. The private Tsumu import link is available for the next hour." The actual handoff includes the real tool-generated link when staging succeeds.
