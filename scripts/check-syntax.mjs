import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const file of globSync("src/**/*.js", { cwd: root }).sort()) {
  execFileSync(process.execPath, ["--check", file], { cwd: root, stdio: "inherit" });
}
