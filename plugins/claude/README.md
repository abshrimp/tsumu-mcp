# Tsumu for Claude

Create an editable Tsumu site from Claude, or pair an open Tsumu site to read or edit it.

## Connect
1. Install the plugin and authorize the remote MCP connection in Claude.
2. To create a new site, select **Allow new-site creation only** in the OAuth window; no existing site or pairing code is required. Open the returned private import URL to create the site in Tsumu.
3. To read or edit an existing site, open it at https://tsumu.ebii.net, use **MCP connection** in the editor menu and select read-only or read/edit permission. Complete OAuth with the one-time code shown in Tsumu.
4. Keep the paired editor tab open during editing. An existing-site grant is limited to its paired site.

The remote server exposes read operations, named-page creation, typed element edits and optional one-time SiteDoc draft handoff. Editing and new-site creation require authorization and appropriate permissions. A new site must be opened and paired separately before Claude can edit it.

## Privacy and support
- [Privacy policy](https://github.com/abshrimp/tsumu-mcp/blob/main/docs/PRIVACY.md)
- [Connection and troubleshooting guide](https://github.com/abshrimp/tsumu-mcp/blob/main/docs/INSTALL.md)
- [Support and issue reports](https://github.com/abshrimp/tsumu-mcp/issues)

This self-contained distribution folder is the **source** for the GitHub marketplace entry `tsumu@tsumu-plugins`, and it also serves directory submissions. It bundles the three Tsumu Skills and all reference documents. The files under `skills/` are synchronized from the repository's top-level `skills/` using `npm run sync:claude`; CI rejects stale copies.

It intentionally contains **no executable code, package manager files, dependency installation, hooks or scripts**. It connects to the hosted MCP server over HTTPS. Source and operating details are available in the parent repository.
