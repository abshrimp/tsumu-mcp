<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tsumu-logo-dark.svg">
    <img src="assets/tsumu-logo.svg" alt="Tsumu" width="360">
  </picture>
</p>

# Tsumu MCP

A standalone remote Model Context Protocol (MCP) server for [Tsumu](https://github.com/abshrimp/tsumu). The Tsumu editor runs independently: no account, local server, or MCP packages are required to edit browser-stored sites.

## Architecture

- **Public MCP URL:** https://mcp.tsumu.ebii.net/mcp (after deployment and custom-domain setup)
- **Runtime:** Cloudflare Workers, Durable Objects for browser sessions and one-time pairing, Workers KV for OAuth tokens and grants.
- **Transport:** Streamable HTTP with OAuth 2.1 authorization-code / PKCE.
- **Data:** The MCP server does **not** persist or mirror paired-site documents. It relays live edits to the paired Tsumu tab. Separately, an explicitly staged **new** SiteDoc can be held in an expiring, single-use Durable Object until the user opens its import URL and the editor confirms saving it.
- **Permission:** One active browser/site per pairing; read-only or read/edit, selected in Tsumu. No publishing or asset deletion.

## Connect

A bilingual (Japanese/English) step-by-step guide with screenshots is served at **https://mcp.tsumu.ebii.net/**. It follows the browser's language by default; `?lang=ja` or `?lang=en` selects one explicitly.

Use the remote MCP endpoint `https://mcp.tsumu.ebii.net/mcp` with an AI client that supports authenticated Streamable HTTP.

### Create a new site without pairing an existing site

1. Add the remote MCP endpoint in your AI client and begin OAuth authorization.
2. Choose **Allow new-site creation only** on the consent page. No Tsumu account, connection code or open editor tab is required.
3. Let the AI client obtain the SiteDoc authoring reference with `get_site_doc_spec` and stage a complete editable SiteDoc using `stage_site_doc`.
4. Open the returned private `importUrl` in Tsumu to import the draft as a separate site. This does **not** publish it or give the AI client access to edit the imported site.

A staged draft expires after one hour and is deleted after the editor confirms that the new site has been saved. Treat the complete URL as a bearer secret and do not share it.

### Read or edit an existing site

1. Open the desired site in Tsumu (at https://tsumu.ebii.net or a self-hosted editor).
2. Open the editor's **MCP connection** menu (Japanese: **AIと接続（MCP）**), choose read-only or read/edit and start the connection.
3. Add the MCP endpoint to your AI client, then inspect the client identity and redirect host on the OAuth consent page. Enter the **single-use connection code** shown in Tsumu.
4. Keep that editor tab open. The browser session expires after one hour and the connection code after ten minutes. You can revoke the browser session immediately with **Disconnect and revoke**.

A connection authorizes **only the paired site** and does not automatically follow newly created sites. Do not share connection codes.

## AI client plugins and distribution

Plugin listing URLs live in one place, [`src/guide-links.js`](src/guide-links.js). Set each `https://` URL once its listing is public; the guide at `/` covers plugins only (no manual MCP setup) and is meant to go public after every listing is set. Published plugins (with icons) are also listed at `/plugins.json`, which the Tsumu editor reads to show plugin links in its MCP connection dialog, so the editor needs no redeploy. Client icons are bundled in `public/plugin-icons/` (see its NOTICE).

The OAuth-protected remote MCP endpoint supports these AI clients:

- **ChatGPT / Codex:** add the remote MCP URL as a custom plugin; public directory publication requires a reviewed submission.
- **Claude / Claude Code:** remote custom connector, a GitHub plugin marketplace and a [dependency-free plugin folder](plugins/claude) for Anthropic's publishing portal.
- **Cursor:** plugin manifest and remote `mcp.json`.
- **Gemini CLI:** installable GitHub extension (`gemini-extension.json`).
- **Google Antigravity:** plugin manifest and `mcp_config.json` for Streamable HTTP.

See [installation instructions](docs/INSTALL.md) for client-specific setup and [public directory submission checklist](docs/PUBLISHING.md) for separate approval and publication steps. **A GitHub-installable plugin is not yet listed in any curated provider directory.**

## Skills and site drafts

This repository bundles three Agent Skills: `tsumu-build-site`, `tsumu-edit-site`, and `tsumu-best-practices`.
Claude Code and Cursor plugin installations can use the `skills/` directory directly.
The MCP endpoint also publishes the **same** skills via the official `io.modelcontextprotocol/skills` extension:
`skills/list`, `skills/get`, and verified `skill://` resources. Ordinary MCP tools are available independently of the Skills Extension.

Skills are bundled for Cloudflare Workers by `npm run generate:skills`; CI checks that the generated bundle
matches the source. Edit `skills/*/SKILL.md` and its text files under `skills/*/references/`;
`src/generated-skills.js` is generated. All reference documents are available through `resources/read`.

`stage_site_doc` accepts a complete `SiteDoc` with `schemaVersion: 1`, up to **12 MiB**.
Include assets as embedded `dataUrl` values within that limit; separate ZIP assets are unsupported.
The returned `importUrl` carries its bearer secret in the URL **fragment**. Tsumu validates
and saves the draft as a new site, then acknowledges consumption so the relay can delete it.
Failed imports can be retried after the **five-minute claim lease**; unconsumed drafts expire
after **one hour**. The editor's `NEXT_PUBLIC_TSUMU_MCP_URL` must point to the same relay.

## Deploy

Requires Node.js 24+, a Cloudflare account, a KV namespace and permission to configure the subdomain.

~~~sh
npm ci
npx wrangler kv namespace create OAUTH_KV
~~~

Set the `OAUTH_KV` namespace ID in `wrangler.jsonc` to a namespace in your Cloudflare account. The checked-in ID belongs to the public deployment. Declare Durable Object classes in `exports` with SQLite storage, and reference those classes in `durable_objects.bindings`.

The browser bridge accepts canonical HTTPS origins, including self-hosted Tsumu instances, and HTTP loopback origins (`localhost`, `127.0.0.1`, `[::1]`) for local development. Other HTTP, opaque, or missing origins are rejected. Sessions require a one-time pairing code, a separate WebSocket secret, and OAuth authorization.

~~~sh
npm run check
npm test
npm run smoke
npm audit --include=dev --audit-level=high
npm run build
npm run deploy
~~~

Configure the Worker's HTTPS domain in Cloudflare. The OAuth `RESOURCE` and `ISSUER` in `src/index.js` must match that domain; this repository configures **mcp.tsumu.ebii.net**. Set both values for your deployment before distributing its endpoint. Keep client manifests, guide URLs and distribution checks consistent with that endpoint.

To connect a self-hosted Tsumu instance to the public MCP server, build the editor with NEXT_PUBLIC_TSUMU_MCP_URL=https://mcp.tsumu.ebii.net (or point it to your own MCP deployment). You do not need to register your editor's hostname with the MCP server. Use HTTPS for remotely hosted editors; HTTP is accepted only on the loopback hosts listed above.

## MCP tools

| Tool | Permission | Action |
| --- | --- | --- |
| list_sites | Read | Return the paired site |
| list_pages | Read | Return page IDs and slugs |
| get_page | Read | Return a page's edit context and SHA-256 revision |
| get_element | Read | Read a node's text, styles and children |
| create_site | Edit | Create a browser-stored site; returns a URL and requires pairing the new site separately |
| create_page | Edit | Create a named page in the paired site |
| apply_operations | Edit | Apply up to 100 strictly typed Tsumu AiOp operations atomically |
| set_text | Edit | Edit an existing element's text |
| set_style | Edit | Update an element's CSS properties |
| insert_element | Edit | Insert an element and optionally nested children |
| get_site_doc_spec | OAuth | Read the SiteDoc authoring guide and editable example |
| stage_site_doc | OAuth | Temporarily stage a complete new editable site and return a one-time import URL |

### Editing safely

- For element edits, call `get_page` first, then pass its `revision` as `expectedRevision`.
- Every paired-site mutation requires a unique `requestId` (8–80 letters, digits, hyphens or underscores). Repeating the **same** request with the same ID returns its cached result when available; changing its action or arguments with the same ID is rejected. Results are retained for ten minutes within an authorized session.
- `apply_operations` uses a discriminated operation schema. Each entry specifies `op` and its required fields. Unsupported operations and invalid types are rejected before reaching the browser. The `set_text`, `set_style` and `insert_element` tools cover common changes.
- A new site is created in the local browser's site list and IndexedDB, but does not become part of the original OAuth grant. Open its returned URL in the same browser and pair it separately before editing. `create_site` is unavailable for server-backed Tsumu storage.
- A new page belongs to the currently paired site, receives an automatically unique URL slug, and can be edited by calling `get_page` using the returned page ID.
- Never blindly retry a timed-out write. Read the page or check the Tsumu browser first to establish whether the write succeeded.

## Security model and limitations

- A signed-in Tsumu account is not required: the **live browser** authorizes access to the particular site.
- The remote MCP OAuth server issues scoped access tokens using the official Cloudflare OAuth Provider. A separate random WebSocket token authenticates the browser; it is transmitted via the WebSocket subprotocol, not a URL parameter.
- Bridge HTTP requests and WebSockets require a valid HTTPS browser Origin (or HTTP loopback for development). The server checks site/session authorization for every operation and denies edits on read-only sessions.
- One-time codes expire in ten minutes and are consumed atomically; failed pairing attempts are rate limited.
- When the browser is closed or disconnected, editing is unavailable. Revoked or expired sessions cannot be used with an OAuth token.
- Browser saves are confirmed before an edit is reported as successful. If a site is also synced to Tsumu's server, that existing sync remains asynchronous; MCP does not claim that publication or cloud sync has completed.
- In production, configure Cloudflare WAF/rate limits for public pairing endpoints, monitor error rates, verify custom-domain OAuth redirects and exercise end-to-end tests with the targeted MCP clients.

This repository does not copy the Tsumu editor's AI-operation engine, document model, or persistence code. MIT licensed.
