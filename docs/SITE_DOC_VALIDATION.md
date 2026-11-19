# SiteDoc validation synchronization

Tsumu's lib/site-import-format.ts is the authoritative source for imported SiteDoc validation.

The stage_site_doc tool runs two checks before allocating a temporary draft:

1. checkStagedSiteDoc gives targeted errors for common AI authoring mistakes, such as unsupported style shapes and missing semantic fields.
2. validateTsumuSiteDoc runs the actual Tsumu editor importer compiled from a pinned upstream revision. Script, tree, asset, and safe-SVG validation are not reimplemented in this repository.

The compiled code is committed at src/generated/tsumu-site-doc-validator.mjs. Production validation performs no network requests and works for self-hosted editor origins. The generator substitutes only the i18n lookup with an English identity translator, and sanitizes a clone as the editor does before checking it.

## Updating when Tsumu changes

1. Review upstream changes to the importer and related validation functions.
2. Set the same new upstream SHA in scripts/build-tsumu-site-doc-validator.mjs, .github/workflows/ci.yml, and .github/workflows/check-tsumu-validator-drift.yml.
3. Clone Tsumu at that exact revision into .tsumu-source and run npm ci --prefix .tsumu-source --ignore-scripts --no-audit --no-fund.
4. Run node scripts/build-tsumu-site-doc-validator.mjs, npm test, and npm run build, then commit the generated module.
5. CI rebuilds the artifact from the pinned Tsumu source and checks for byte-for-byte identity. The daily drift workflow alerts when validation-related upstream source files change.

This is a pinned, reproducible build: never execute remotely fetched code in the worker, and never submit private SiteDoc bodies to a third-party validation service.
