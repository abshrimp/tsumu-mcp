# Install Tsumu MCP in AI clients

Tsumu MCP uses one remote Streamable HTTP endpoint for every AI client:

    https://mcp.tsumu.ebii.net/mcp

For an existing site, the browser tab holds the document and authorizes the connection. New-site creation uses a separate grant with temporary draft storage.

## Two authorization paths

**For a new site:** Add the MCP endpoint to your AI client and choose **Allow new-site creation only** on the OAuth page. This grant needs no existing Tsumu site, editor tab or connection code. It permits `get_site_doc_spec` and `stage_site_doc`, but cannot list, read or edit an existing site. Open the returned import link to create a new site in the editor; it is not automatically published.

**For an existing site:** On the OAuth page, choose an official Tsumu site directly from the list (shown only when you have sites), then select its permission. A trusted frame on `tsumu.ebii.net` shares only the non-secret site list with the MCP authorization page; no authentication credentials or documents are copied.

For **self-hosted editors**, open **AIと接続（MCP）** in the editor, issue a connection code, then expand **Connect a self-hosted Tsumu site** below **Allow new-site creation only** on the OAuth page. Enter the one-time code there.

Keep the editor tab open while editing. Browser permissions last up to seven days of inactivity, with automatic short-session renewal while connected. Existing-site grants can cover multiple explicitly approved sites: call `list_sites`, `select_site`, or `request_site_access` to add another site. A newly created site never inherits permission automatically.

A screenshot guide for end users (Japanese and English) is served at https://mcp.tsumu.ebii.net/. While the plugin listings are under review it shows the manual setup for each client; `GUIDE_MODE` in `src/guide-links.js` switches it to the plugin-only guide.

The connection choices are always in this order: available official sites, **Allow new-site creation only**, then the self-hosted connection code. The official-site section is omitted when there are no accessible sites.

## Skills and new-site handoff

The plugin packages include `skills/` instructions for Tsumu site building and editing.
MCP clients implementing the official Skills Extension can discover the same content using
`skills/list` and `skills/get`; other clients continue using the normal MCP tools.

For a new site built entirely by AI, call `stage_site_doc` with a valid `SiteDoc` and
open the returned one-time URL in Tsumu. The browser imports and saves it as a separate
new site, then acknowledges deletion of the temporary relay copy. The fragment is secret,
the link expires after one hour, and the draft is limited to 12 MiB. If import fails,
retry after the five-minute claim lease; never describe a staged document as published.
For self-hosted editors, pass a trusted `editorOrigin` and ensure the frontend uses the
same `NEXT_PUBLIC_TSUMU_MCP_URL` as the MCP server.

## ChatGPT and Codex

Add a custom remote MCP server in ChatGPT Plugins. Set its URL to the MCP endpoint above and use OAuth. Choose new-site creation or enter a connection code from Tsumu. A private developer plugin and a public directory listing have separate publication settings.

## Claude and Claude Code

In Claude, go to Customize → Connectors → Add → Custom → Web, enter the MCP endpoint and follow the OAuth pairing. You may use the Claude published client identity or dynamic registration where supported.

For Claude Chat, Desktop, Cowork, and Claude Code, the GitHub marketplace is at `abshrimp/tsumu-mcp`. In Claude, open **Customize → Plugins → Add → Add marketplace**, enter this repository, and install **Tsumu** from **tsumu-plugins**. The marketplace uses `plugins/claude/` as its plugin root to avoid treating the server source and build scripts as plugin files. The dedicated folder bundles the remote MCP configuration, icon, and all three Skills with their references. Authorize the remote MCP connection after installation.

For Claude Code, the same GitHub-hosted plugin marketplace is included:

    /plugin marketplace add abshrimp/tsumu-mcp
    /plugin install tsumu@tsumu-plugins

The plugin's .mcp.json config uses the remote endpoint. For the **official Claude Directory review**, use the separate, restricted-file-safe folder [plugins/claude](https://github.com/abshrimp/tsumu-mcp/tree/main/plugins/claude), **not the repository root**. No package installation or executable files are included there. Claude Directory listing requires independent review.

## Cursor

Import the repository as a plugin where supported, or configure ~/.cursor/mcp.json:

~~~json
{
  "mcpServers": {
    "tsumu": { "url": "https://mcp.tsumu.ebii.net/mcp" }
  }
}
~~~

The repository includes a Cursor manifest at .cursor-plugin/plugin.json and the remote mcp.json. Authenticate with OAuth when prompted. Official marketplace listing is reviewed separately.

## Gemini CLI

Install the repository extension:

~~~sh
gemini extensions install https://github.com/abshrimp/tsumu-mcp
~~~

Restart Gemini CLI and sign in through the OAuth flow. Alternatively, configure Gemini settings:

~~~json
{
  "mcpServers": {
    "tsumu": {
      "httpUrl": "https://mcp.tsumu.ebii.net/mcp",
      "authProviderType": "dynamic_discovery"
    }
  }
}
~~~

Gemini CLI uses httpUrl for Streamable HTTP.

## Google Antigravity

Install the plugin from the public GitHub repository where supported, or add this to Antigravity's MCP configuration:

~~~json
{
  "mcpServers": {
    "tsumu": {
      "serverUrl": "https://mcp.tsumu.ebii.net/mcp"
    }
  }
}
~~~

The repository includes .antigravity-plugin/plugin.json and mcp_config.json. Antigravity uses serverUrl, not Gemini CLI's httpUrl. The curated Marketplace has a separate partner review process.

## Troubleshooting

- OAuth succeeded but tools are missing: rescan, reconnect, or restart the client to refresh its discovered tools.
- No site is available: a new-site-only grant intentionally exposes no existing-site tools. For a paired-site grant, confirm that the editor tab remains open and connected.
- Write failed: select read/edit permission and obtain a fresh revision with get_page.
- An operation timed out: do not blindly repeat the mutation with a new requestId. Inspect the document state first.
- create_site returned a new URL: open that site in the same browser and pair it again before editing it.
- OAuth or tool discovery is unsupported: verify support for authenticated remote Streamable HTTP MCP in that client and plan.

See docs/PUBLISHING.md for the separate approval steps for official directories.
