# Setup checklist (things only Arunav can do)

Use the project Gmail for every sign-up. All free tiers.

1. **GitHub repo**: create `weblaze/tensor` and push this folder. Note: `docs/` contains internal business details (partners' discussion, costs, staff names). Keep the repo private, or remove `docs/01` and `docs/05` before making it public.
2. **Supabase**: project `tensor` already exists in the "Ops Tracker" org. Copy the **secret key** from Dashboard → Project Settings → API Keys into `.env.local` as `SUPABASE_SECRET_KEY`. Connect the Supabase MCP server in Claude Code so agents can run migrations.
3. **Telegram bot** (2 minutes, on your phone): open @BotFather → `/newbot` → name "Tensor Demo" → username like `tensor_dm_bot` → copy the token into `TELEGRAM_BOT_TOKEN` and the username into `TELEGRAM_BOT_USERNAME`.
4. **Gemini key**: aistudio.google.com → sign in → Get API key → `GEMINI_API_KEY`.
5. **Cloudflare**: sign up with Gmail; agents will run `wrangler login` (opens your browser) and deploy. Fallback: Vercel with Gmail/GitHub login.
6. Pick `OFFICE_PIN` and random strings for `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET`.
7. After deploy: set `APP_URL`, register the Telegram webhook, and ask the lead agent to create the pg_cron job.
8. For the demo: two phones linked to the bot (one as supervisor Om, one as doctor), using link codes from `/people`.
