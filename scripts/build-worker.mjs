// Production Workers build. Next/OpenNext read .env* files at build time and inline them into the
// worker (.open-next/cloudflare/next-env.mjs), which would ship local dev secrets. Move local env
// files aside for the build so the worker only gets Cloudflare vars and secrets.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";

const hidden = [".env.local", ".env.development.local", ".env.production.local", ".env"].filter(existsSync);
for (const f of hidden) renameSync(f, `${f}.build-hidden`);
try {
  execSync("npx opennextjs-cloudflare build", { stdio: "inherit" });
} finally {
  for (const f of hidden) renameSync(`${f}.build-hidden`, f);
}

const inlined = readFileSync(".open-next/cloudflare/next-env.mjs", "utf8");
if (/SUPABASE_SECRET_KEY|TELEGRAM_BOT_TOKEN|OFFICE_PIN|CRON_SECRET|SESSION_SECRET/.test(inlined)) {
  console.error("Refusing: secrets were inlined into the worker bundle.");
  process.exit(1);
}
console.log("Worker bundle has no inlined secrets.");
