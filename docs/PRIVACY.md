# Tsumu MCP Privacy Policy

**Effective date:** November 19, 2026

This notice describes the **Tsumu MCP service** hosted at `https://mcp.tsumu.ebii.net`. It does not replace the privacy notices of the Tsumu website builder, your AI client, or your hosting provider.

## What the service processes

- **Connection metadata:** a site identifier and name, the permission selected in Tsumu (read-only or read/edit), session identifiers, authorization scopes, expiration times, and cryptographic hashes used to verify short-lived pairing codes and browser connections.
- **Authentication data:** OAuth client registrations, authorization grants and tokens necessary for connecting compatible AI clients.
- **Usage and abuse protection:** network request information, including IP addresses or one-way derived hashes used for rate limiting, together with operational errors and security events.
- **Requested site information:** when you authorize a client and invoke an MCP tool, the service relays the relevant pages, elements and editing operations between that AI client and the paired Tsumu browser tab.
- **Optional temporary site drafts:** if an AI client invokes the SiteDoc handoff feature, the site draft is stored temporarily in an isolated Cloudflare Durable Object to generate a one-time import link. A draft is limited to 12 MiB, expires after approximately one hour and is removed after a successful completion acknowledgement or expiry cleanup.

The service does **not** need your Tsumu account password. The site editor's normal document store remains in your browser or the storage configured for your Tsumu installation. Except for an explicitly requested temporary SiteDoc handoff, the MCP relay is not designed as a persistent copy of your website documents.

## Why this information is used

We use the information above to authorize connections you initiate, enforce the site's permissions, relay the edits and reads you request, prevent unauthorized access and excessive requests, and operate and troubleshoot the service.

## Storage and service providers

The MCP service runs on **Cloudflare Workers, Durable Objects and Workers KV**. Connection/session state and pairing records may remain in those systems beyond a session's functional expiration until cleanup. The default connected-site session expires after one hour, while pairing codes expire after ten minutes. OAuth grant/token retention follows the provider's configured storage and revocation behavior and is not equivalent to the session lifetime.

When you use an AI client such as Claude, ChatGPT, Cursor or Gemini, the site data you ask that client to read or change is also processed by **that AI client** under its own terms and privacy policy. Please review the privacy practices of the AI service you choose.

Hosting and security providers may separately generate service logs and process request metadata in accordance with their operating policies. This notice does not promise a fixed log-retention period.

## Your choices

- Choose read-only permission when editing is not required.
- Do not authorize a connection unless you recognize the AI client and its redirect destination.
- Disconnect and revoke a pairing in the Tsumu editor to block further operations for that browser session.
- Close the browser tab to interrupt the live relay; note that closing the tab alone does not necessarily revoke an already-issued OAuth token.
- Avoid staging confidential site drafts; an import link contains a one-time secret, and anyone with the complete link may be able to claim that draft while it is valid.

## Security and limitations

The service uses HTTPS, one-time pairing codes, separate WebSocket authorization tokens, OAuth and permission checks. No internet service can guarantee absolute security. For privacy-sensitive sites, review the AI client's data-handling settings before connecting.

## Contact

For questions about this connector's operation and privacy, open a support issue at
https://github.com/abshrimp/tsumu-mcp/issues

The repository source is available at https://github.com/abshrimp/tsumu-mcp.
