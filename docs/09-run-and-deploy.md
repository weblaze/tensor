# Run, test and deploy

## Run locally

```bash
npm install
cp .env.example .env.local     # then fill in values (see below)
npm run dev                    # http://localhost:3000, office PIN from OFFICE_PIN
```

No Supabase key yet? Set `TENSOR_FIXTURE=1` in `.env.local`. The app then runs on in-memory demo data (the same four sites as `reseed_demo()`), dates relative to today. Changes last until the dev server restarts. Fixture mode is ignored in production builds.

### Telegram on localhost

Telegram cannot reach localhost, so poll instead of using a webhook:

```bash
npm run dev       # terminal 1
npm run poll      # terminal 2: forwards bot messages to /api/telegram
```

Then on a phone: open the bot, send `/start OM0142` (Om's code, see People), and send a photo with a caption.

### Checks

```bash
npm run typecheck
npm run build
npm test            # unit tests (also run by GitHub Actions on every push)
npm run check:ai    # keyword classifier on sample messages
```

## Environment

| Name | Where | Notes |
|---|---|---|
| `SUPABASE_URL` | var | `https://gwgthatwoxuggidblodi.supabase.co` |
| `SUPABASE_SECRET_KEY` | secret | Supabase → Project Settings → API Keys → secret key. Server only. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | secret / var | From @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | secret | Any random string |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | secret / var | Optional. Without it, keyword rules sort updates and voice notes are not transcribed. |
| `OFFICE_PIN` | secret | Shared office passphrase. Production refuses fewer than 10 characters; 5 wrong tries lock login for 15 minutes |
| `SESSION_SECRET` | secret | Random string that signs the office cookie |
| `CRON_SECRET` | secret | Bearer token for `/api/cron` |
| `APP_URL` | var | Public URL, used in doctor report links |
| `DEMO_MODE` | var | `1` only on a demo deployment: shows the Demo badge and allows Reset demo data. `0` in production |
| `TENSOR_FIXTURE` | dev only | `1` = in-memory demo data |

## Deploy to Cloudflare Workers (free)

Secrets live in `.prod-secrets.json` (git-ignored, generated locally; it holds the office passphrase).

```bash
npx wrangler login                              # opens the browser once
npx wrangler secret bulk .prod-secrets.json     # uploads every secret
npm run deploy
```

Add `APP_URL` (the `https://tensor.<account>.workers.dev` URL from the deploy output) to `vars` in `wrangler.jsonc` and deploy again.

### Database for production

Apply `supabase/migrations/20261106000000_prod_hardening.sql`, then start clean:

```sql
select reset_to_production();   -- removes demo projects and doctors, keeps templates and staff,
                                -- issues fresh link codes, turns demo mode off
```

After this, `reseed_demo()` refuses to run on this database.

The bundle is about 1.3 MB gzipped, under the 3 MB Workers free limit.

### After deploy

1. Register the webhook (stops `npm run poll` from working; that is expected):

   ```bash
   APP_URL=https://tensor.<account>.workers.dev npm run webhook
   ```

2. Schedule the hourly checks with Supabase `pg_cron` + `pg_net`. Run once in the Supabase SQL editor, with the real URL and `CRON_SECRET`:

   Production is already set up (job `tensor-hourly`). For a new environment, after the `cron_extensions` and `advisor_fixes` migrations:

   ```sql
   select vault.create_secret('<CRON_SECRET>', 'tensor_cron_secret');

   select cron.schedule('tensor-hourly', '5 * * * *', $$
     select net.http_post(
       url := 'https://tensor.<account>.workers.dev/api/cron',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tensor_cron_secret'),
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     );
   $$);
   ```

   Each run is safe to repeat: alerts, escalations and reports are sent once. The doctor report goes from 9 PM India time; quiet-site reminders from 6 PM.

3. Link each person's phone from the People screen (they send `/start CODE` to the bot; each code works once).

## Fallback host

Vercel Hobby works with no code changes (`vercel deploy`), but its terms say non-commercial use only. Use it only if Cloudflare blocks the demo.
