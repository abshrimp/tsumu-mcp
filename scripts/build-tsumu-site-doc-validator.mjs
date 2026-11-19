import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const TSUMU_REVISION = "dc616e4caf7493b1bb5b060774001539851ad230";
const SOURCE = resolve(process.env.TSUMU_SOURCE_DIR || ".tsumu-source");
const OUTPUT = resolve("src/generated/tsumu-site-doc-validator.mjs");
const checkOnly = process.argv.includes("--check");

const actual = execFileSync("git", ["rev-parse", "HEAD"], { cwd: SOURCE, encoding: "utf8" }).trim();
if (actual !== TSUMU_REVISION) {
  throw new Error("Tsumu validator source must be " + TSUMU_REVISION + ", found " + actual);
}
const requireFromTsumu = createRequire(pathToFileURL(resolve(SOURCE, "package.json")));
const { build } = requireFromTsumu("esbuild");
const output = await build({
  stdin: {
    sourcefile: "site-doc-validation-entry.ts",
    resolveDir: SOURCE,
    loader: "ts",
    contents: [
      'import { validateImportedDoc } from "./lib/site-import-format.ts";',
      'import { sanitizeImportedInlineIcons } from "./lib/imported-svg.ts";',
      "// Match Tsumu's actual JSON / ZIP importer: sanitize a copy before validating.",
      "export function validateTsumuSiteDoc(value: unknown): void {",
      "  validateImportedDoc(sanitizeImportedInlineIcons(structuredClone(value)));",
      "}",
    ].join("\n"),
  },
  bundle: true,
  write: false,
  minify: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  legalComments: "none",
  plugins: [{
    name: "translate-import-errors-only",
    setup(builder) {
      // The canonical validation logic is unchanged. MCP only needs English errors;
      // loading the editor's React i18n and locale UI into a Worker is unnecessary.
      builder.onResolve({ filter: /^\.\/i18n$/ }, args => {
        if (args.importer.replaceAll("\\", "/").endsWith("/lib/site-import-format.ts")) {
          return { path: "translation", namespace: "tsumu-validation-translation" };
        }
      });
      builder.onLoad({ filter: /.*/, namespace: "tsumu-validation-translation" }, () => ({
        contents: "export const tr = text => text;",
        loader: "js",
      }));
    },
  }],
});
const generated = [
  "// Generated from abshrimp/tsumu at " + TSUMU_REVISION + ".",
  "// Do not edit; run scripts/build-tsumu-site-doc-validator.mjs in a pinned Tsumu checkout.",
  output.outputFiles[0].text,
].join("\n");
if (checkOnly) {
  if (await readFile(OUTPUT, "utf8").catch(() => "") !== generated) {
    throw new Error("The generated SiteDoc validator is missing or out of sync with Tsumu");
  }
  console.log("Authoritative Tsumu SiteDoc validator is synchronized");
} else {
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, generated, "utf8");
  console.log("Generated authoritative SiteDoc validator from " + TSUMU_REVISION);
}
