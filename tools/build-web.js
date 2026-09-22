import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const localChat = process.argv.includes("--local-chat");
if (dirname(output) !== root) throw new Error("Invalid build output");
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "src"), { recursive: true });

let html = readFileSync(resolve(root, "index.html"), "utf8");
if (!localChat) html = html.replace(/<!-- LOCAL_CHAT_START -->[\s\S]*?<!-- LOCAL_CHAT_END -->/g, "");
writeFileSync(resolve(output, "index.html"), html);
cpSync(resolve(root, "styles.css"), resolve(output, "styles.css"));

for (const file of ["app.js", "blink-engine.js", "interaction.js"]) {
  cpSync(resolve(root, "src", file), resolve(output, "src", file));
}

if (localChat) {
  for (const file of ["chat-client.js", "supabase-chat.js", "supabase-config.js"]) {
    cpSync(resolve(root, "src", file), resolve(output, "src", file));
  }
  mkdirSync(resolve(output, "docs"), { recursive: true });
  mkdirSync(resolve(output, "supabase"), { recursive: true });
  cpSync(resolve(root, "docs", "SUPABASE_SETUP.md"), resolve(output, "docs", "SUPABASE_SETUP.md"));
  cpSync(resolve(root, "supabase", "schema.sql"), resolve(output, "supabase", "schema.sql"));
}

console.log(localChat
  ? "Built localhost edition in dist/ (communication + local chat)."
  : "Built public edition in dist/ (chat/auth/database files excluded)."
);
