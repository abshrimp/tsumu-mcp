---
name: tsumu-edit-site
description: Change, redesign, or add pages and elements in an EXISTING Tsumu website using the paired browser editor, with revision checks and verified saves. Not for creating a separate new site.
---

# Edit an existing Tsumu website

Use when the user refers to a site already open or paired in Tsumu, asks for a change, or requests another page in that existing site. Do not treat the task as an export or new-site creation.

## Select the correct site

1. Call `list_sites` to inspect only explicitly authorized sites, their connection status and permissions. If necessary, call `select_site` before inspecting pages. Use `siteId` for a unique site; when different Tsumu instances share the same ID, use the exact `siteRef` returned by `list_sites`. Then call `list_pages` for the selected site.
2. If the requested site is missing from the authorized list, use `request_site_access` to produce a short-lived approval link and ask the user to explicitly approve that site. If `list_sites` reports `connected: false`, ask the user to open that site’s `openUrl` in the same browser that authorized it, then retry only after it reconnects. The AI client must not open browser tabs automatically or claim a disconnected edit succeeded. Never assume permission or infer additional sites.
3. If the selected site is read-only, request a new editing permission. **Do not substitute `stage_site_doc` and pretend the original site was updated.**
4. Use `create_page` only when the request requires a new page **within the selected site**. New site creation is a different task; use `tsumu-build-site` instead.

## Inspect, change, verify

1. Read the current page with `get_page` and obtain its `revision`, page ID and element IDs. Use `get_element` to inspect a particular element when needed. Preserve existing content and behavior unless the user requested replacement.
2. Plan the smallest cohesive changes consistent with the site's existing typography, breakpoints, layout and design. Honor explicit requests for animations and script behavior only where supported by the current operation schema.
3. Use `set_text`, `set_style` and `insert_element` for simple edits. For multi-element changes, use `apply_operations` (1–100 typed operations per call) so related edits are grouped. Set `op` to the operation name, for example `set_text`. Use the tool schema for the fields of each operation and its `AiNode` inputs.
4. Supply `expectedRevision` from the latest `get_page` and a distinct `requestId` (8–80 allowed characters) for each new write. On a revision conflict, fetch the page again and replan against the latest content.
5. On timeout or disconnection, **do not blindly resend the write with a different requestId**. Inspect the current page or browser to determine whether it was saved before retrying.
6. Re-read affected pages/elements and confirm changes to the extent the tools permit. If the user requested motion, scripts, navigation or mobile layout, verify those details where possible; never claim visual testing without actual preview access.

## Report the result

Summarize the **specific changes actually saved** and note any part that could not be implemented or verified. The existing site's URL may be reported only if a tool returned it; do not invent links. Editing via MCP does not by itself publish, deploy, confirm cloud synchronization, upload arbitrary assets or delete assets. Do not report those actions as complete.

For detailed review of site structure and accessibility, use `tsumu-best-practices`.
