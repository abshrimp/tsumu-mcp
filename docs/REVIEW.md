# Optional reviewer sample login

`GET /review` on the canonical MCP host provides a real dedicated username/password login. Successful sign-in prepares a new fixed synthetic SiteDoc with Home, 404, and the `node_heading` heading “Tsumu Review Home”. It does not log in to OAuth, issue an MCP token, create a persistent pairing code, or grant access to existing sites.

## Disabled by default

No environment settings are added by this change. The route returns 404 unless both settings are valid:

- `REVIEW_USERNAME`: dedicated ASCII username (letters, digits, underscore or hyphen, up to 100 characters).
- `REVIEW_PASSWORD_HASH`: secret verifier in `pbkdf2-sha256$100000$<32 lowercase salt hex characters>$<64 lowercase derived-key hex characters>` format. PBKDF2-HMAC-SHA256, a random 16-byte salt, 100,000 iterations, 32-byte output; compatible with Workers Web Crypto. Use a password-manager-generated high-entropy password, not a human-chosen password. Never commit or log the password or verifier. Provision through the operator's approved secret-management workflow only.

There is no credential expiry; removing either setting disables access immediately. Changing the verifier rotates the credential. No login cookie or server login session is issued, so there are no reviewer login sessions to invalidate. Already minted synthetic-only links retain their normal one-hour expiry until consumed. Rotation does not revoke ordinary OAuth grants created by reviewers through the normal consent flow; those remain subject to the normal OAuth revocation and browser-session expiry rules.

Do not activate until the operator has reviewed the scope and validated the complete reviewer flow. Provide actual reviewer credentials privately in the submission portal only, not in instructions, Git, logs, query strings or chat. This feature is not a claim that the review portal accepts any particular credential format or supports headless review.

## Reviewer workflow

1. In a fresh browser profile without any existing Tsumu sites or hosting accounts, visit `/review` and sign in with the dedicated reviewer username/password.
2. Open the prepared sample link in the same profile. The normal Tsumu import saves a separate browser-local site; keep the editor tab open.
3. In AI connection (MCP), enable editing and generate a normal temporary code. Complete the ordinary Tsumu OAuth consent using that code. The reviewer password is **not** a pairing code.
4. List pages, read Home, and add a page with heading “Welcome to Tsumu”. Check the editor result. Do not connect hosting accounts, publish, or delete.
5. Close the review profile when finished. Sign in again for a fresh sample if necessary.

The gate controls sample creation, not access to the public Tsumu editor. It cannot enforce how a person uses the public editor outside this workflow. No browser-independent editing or always-online reviewer session is provided.

## Boundaries and retention

- Only the bundled synthetic fixture can be staged. No uploaded or user-specified document, destination, site ID or OAuth scope is accepted.
- Password verification has generic failures and constant-time comparisons of fixed-size hashes. Attempts are limited before password hashing to 12 globally and 3 per trusted Cloudflare client IP per 10-minute window. Missing IP shares one bucket; forwarded headers are not trusted. A dedicated `PairingRegistry` instance isolates these counters from ordinary pairings. Distributed abuse can temporarily exhaust this intentionally conservative global budget.
- Counter keys contain hashes, not raw IP addresses. Existing alarm cleanup removes expired counters. No credentials, request bodies, import URLs or exception details are logged by this route.
- The existing draft storage keeps the sample for at most one hour and deletes after confirmed import. Its bearer secret stays in a URL fragment, not an HTTP query. The page has no external resources or scripts and sends `no-store`, `no-referrer`, `noindex`, CSP and frame protections.
- No persistent MCP code, authentication bypass, permission widening, hosting configuration, publish or deletion action is introduced.

## Verification before activation

Local unit tests cover disabled configuration, same-origin restrictions, request bounds, generic login failures, quota failure, exact synthetic fixture, fragment-only link delivery, revocation and error secrecy. Existing tests cover staging/import and normal OAuth/pairing. A complete live review-profile → import → pairing → ChatGPT read/write flow must still be verified after separately approved secret provisioning. Local tests do not establish portal acceptance or live availability.
