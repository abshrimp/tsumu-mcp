# Publishing Tsumu MCP to AI directories

This repository publicly distributes ready-to-install MCP client configurations. **GitHub availability is not directory approval.** Each catalog has its own account, review, and publication workflow. Do not claim a listing is live until its public URL is verified.

## Directory submissions

| Directory / client | Public submission | Requirements | Current state |
| --- | --- | --- | --- |
| ChatGPT + Codex | https://developers.openai.com/plugins/deploy/submission | Verified OpenAI developer/business identity, Apps Management write access, HTTPS MCP, domain verification, review material, published privacy/terms/support pages | GitHub package and MCP ready; submission not made |
| Claude + Claude Code | https://claude.ai/directory/manage | Select the **plugins/claude** subdirectory, not the repository root; dependency-free remote MCP, 512px PNG icon and privacyPolicyUrl are required for non-Verified publishers | Isolated plugin prepared; revalidation and submission required |
| Cursor Marketplace | https://cursor.com/marketplace/publish | Public Git repo containing a valid Cursor plugin manifest, working MCP and install instructions; manual security review | Repository manifest ready; submission not made |
| Gemini CLI | https://geminicli.com/docs/extensions/user-guide/ | Root gemini-extension.json; installs from public GitHub URL without prior directory approval | Repository extension ready; optional Gallery listing not submitted |
| Google Antigravity Marketplace | https://antigravity.google/docs/build-plugins/ | Valid manifest, bundled logo, README and MCP configuration; partner intake and review for curated listing | Repository plugin ready; partner submission not made |

After a listing is approved and its public URL is verified, set it in `src/guide-links.js` (`pluginLinks`) and deploy. The connection guide at `/` and the Tsumu editor's dialog (via `/plugins.json`) then show a **Get the plugin** link for that client.

The same production endpoint powers all integrations:

    https://mcp.tsumu.ebii.net/mcp

## Before requesting review

1. Verify that the updated Tsumu editor and Cloudflare Worker are deployed, then smoke-test live OAuth and tool discovery separately with ChatGPT, Claude, Cursor, Gemini CLI and Antigravity.
2. Confirm the plugin can list pages, read a page, safely edit, and reject writes in read-only mode. Do not submit until session reconnect, expiration and revocation work across clients.
3. Publish accurate product information: website, support contact/URL, privacy policy URL, terms URL, and a logo consistent with Tsumu branding. **Publisher must review and approve these policies.** Do not guess how long Cloudflare retains logs or promise deletion periods that have not been audited.
4. Prepare reviewer access for the ephemeral browser pairing flow. Reviewers must be able to pair a safe demo site and keep its browser tab open. Pairing codes expire, cannot be shared long-term, and are single-use. Do not hardcode a reusable code or weaken authorization to pass review.
5. Document the limitations: one site per pairing, default one-hour session lifetime, browser tab needed, new site needs a new pairing, write actions only when explicitly enabled, no publishing/asset deletion.
6. Produce review cases and expected outputs without exposing real user documents or access tokens.
7. Complete account/organization identity verification and any domain challenge manually in the corresponding provider portal. Only then submit, respond to review, and publish after approval.

## OpenAI review-specific items

Current directory guidance also asks for:
- Five successful usage scenarios and three negative test cases with expected behavior.
- Per-tool safety annotations (read-only, destructive and open-world) consistent with the actual behavior.
- Domain verification: serve the exact provider-supplied token at /.well-known/openai-apps-challenge on the MCP host or an allowed parent host. **Do not invent a challenge token.**
- Tsumu authorizes anonymous browser pairing and new-site creation without collecting email addresses. It does not expose an OIDC UserInfo endpoint or verified email claims. Check whether the target workspace permits this authentication model before submitting.
- Accurate privacy and support links and a reviewer-usable live OAuth test flow.

Suggested **positive** review cases:
1. Pair a Tsumu browser site in read-only mode and call list_sites.
2. List pages of that site and read a page with get_page.
3. Pair with read/edit permission, create_page and verify the new page in Tsumu.
4. Change a text element with set_text using the current page revision, verify persisted browser content.
5. Insert an element with insert_element, then read the page again.

Suggested **negative** review cases:
1. In a read-only pairing, create_page must fail without changing data.
2. A mismatched expectedRevision must fail without overwriting the document.
3. An operation without a supported op discriminator must be rejected before mutation.

## Provider-specific limitations

- Claude Directory: the plugin may be submitted by supplying a remote MCP URL; Claude Code GitHub marketplace installation is separate and does not imply Claude approval.
- Cursor: submission is of this public Git repository, not a second MCP backend. Installability still needs a clean Cursor client test.
- Gemini CLI: GitHub is already a direct installation channel once the manifest has been merged; registry promotion is a separate action.
- Antigravity: validate the plugin locally using agy plugin validate, then submit to the official partner intake form linked from the Antigravity docs.
- A ChatGPT private DEVELOPMENT plugin is **not** a published ChatGPT/Codex Directory listing.

## Sources (checked 2026-11)

- OpenAI https://developers.openai.com/plugins/deploy/submission
- OpenAI https://developers.openai.com/plugins/build/auth
- Claude https://claude.com/resources/articles/build-plugins-for-claude
- Claude https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities
- Cursor https://cursor.com/docs/plugins
- Cursor https://cursor.com/docs/reference/plugins
- Gemini CLI https://geminicli.com/docs/extensions/reference/
- Google Antigravity https://antigravity.google/docs/build-plugins/
