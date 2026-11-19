---
name: tsumu-edit-site
description: Change, redesign, or add pages and elements to an EXISTING paired Tsumu website. Use for requests such as "このサイトにページを追加して", "Tsumuのページを編集して", or "redesign my Tsumu site". Read the paired site, check revisions, apply edits, and verify saves. Do not use to create a separate new website or to give advice without editing; use tsumu-build-site or tsumu-best-practices instead.
license: MIT
compatibility: Requires a paired, connected Tsumu editor tab and the appropriate OAuth permission through https://mcp.tsumu.ebii.net/mcp.
metadata:
  author: abshrimp
---

# Edit an existing Tsumu website

Use when the user refers to a site already open or paired in Tsumu, asks for a change, or requests another page in that existing site. Do not treat the task as an export or new-site creation.

## Select the correct site

1. Call `list_sites` to see the one site authorized for this pairing. Use `list_pages` to identify the target page; never presume access to other sites.
2. If there is no pairing, the browser tab is disconnected, permission is read-only, or the intended site differs from the paired site, report the limitation and request the relevant connection/permission. **Do not substitute `stage_site_doc` and pretend the original site was updated.**
3. Use `create_page` only when the request requires a new page **within this paired site**. New site creation is a different task; use `tsumu-build-site` instead.

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
