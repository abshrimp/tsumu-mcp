---
name: tsumu-best-practices
description: Review or improve a Tsumu website's visual quality, responsiveness, accessibility, maintainability, scripts, animations, and document integrity; use for design audits and technical questions, not as the primary creation or editing workflow.
---

# Review Tsumu site quality

Use when the user asks how to make a Tsumu site more polished, efficient, accessible, responsive or reliable, or requests a design/implementation review. Creation and editing are handled by `tsumu-build-site` and `tsumu-edit-site` respectively.

## Visual and content quality

- Create a clear content hierarchy with purposeful sections, consistent spacing, readable typography, considered contrast and a coherent visual identity. Follow the user's branding and constraints rather than forcing a single style.
- Inspect desktop **and** mobile: navigation, text wrapping, grids, touch targets, horizontal overflow, meaningful responsive breakpoints and images. Use the actual Tsumu responsive model; do not promise a tested layout without rendering it.
- Make navigation meaningful; use accessible element semantics, one sensible top-level heading, useful link text, image alt text, labeled controls, readable text sizes and visible interaction feedback.
- Prefer specific and credible writing over filler. Never invent real addresses, operating hours, testimonials, guarantees or external links.

## Native editor model

- The source is a `SiteDoc` with `schemaVersion: 1`, `siteName`, `pages`, `pageOrder`, `nodes`, `assets`. The persisted model and the MCP editing `AiNode` schema **are different**. Use the correct one for the selected tool.
- Prefer editable native nodes to code embeds or raw HTML pages, so users can continue visual editing.
- Check references between pages, nodes, components and assets; use stable unique IDs and preserve node ordering. For design data, use `styles.base.default` and valid breakpoint/state overrides.
- Use Tsumu's current type definitions for scripts, animation/motion, components, links, forms and asset metadata. A mock button without a valid interaction is not functional. Avoid unsupported fields and invented runtime APIs.
- For new documents, see `tsumu-build-site/references/site-doc.md`; for existing-site changes, obtain the latest page revision and handle write conflicts safely.

## Storage and sharing boundaries

- `stage_site_doc` is temporary transport for **new** documents. It returns a private, one-hour import URL, **not** a published site; Tsumu removes the temporary copy after it confirms a successful import. It cannot move ZIP assets separately.
- Existing-site editing requires a paired browser tab, appropriate permission and a verified save. A completed MCP edit does not prove server sync or publication.
- Do not place API credentials, personal data, secrets or untrusted executable code into a shareable site document. Use the standard Tsumu import/validation path; do not bypass sanitization.
- State uncertainty and distinguish **implemented**, **saved**, **visually tested**, **imported** and **published**. These are separate outcomes.

When asked to perform improvements rather than only suggest them, choose the matching build/edit skill and actually use its tools; do not stop at recommendations if a valid edit action is available.
