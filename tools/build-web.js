import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
if (dirname(output) !== root) throw new Error("Invalid build output");
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "docs"), { recursive: true });
mkdirSync(resolve(output, "supabase"), { recursive: true });
for (const file of ["index.html", "styles.css", "src", "docs/SUPABASE_SETUP.md", "supabase/schema.sql"]) {
  cpSync(resolve(root, file), resolve(output, file), { recursive: true });
}
console.log("Built static frontend in dist/ (app, setup guide and public schema only).");
