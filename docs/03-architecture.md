# Architecture

## Stack (prototype, free tiers only)

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js 15 (App Router, TypeScript, server actions) | One app: office web app, doctor report, API routes |
| Styling | Plain CSS with Tensor tokens (`docs/04-design-system.md`) | No UI framework needed; mobile-first |
| Database, storage | Supabase free tier | Project `tensor`, ref `gwgthatwoxuggidblodi`, org "Ops Tracker" (`iwebonwfpjkvspldnubk`), ap-south-1. Bucket `site-media` (private, signed URLs) |
| Messaging | Telegram Bot API | Stand-in for WhatsApp. Behind `lib/messaging` interface |
| AI | Gemini API free tier (`gemini-2.5-flash`, configurable) | Voice transcription (Hindi → English one-liner) + classification with JSON schema output. Behind `lib/ai`; keyword fallback when no key / quota hit |
| Scheduled jobs | Supabase `pg_cron` + `pg_net` calling `POST /api/cron` with `CRON_SECRET` | Host-independent. Plus a "Run daily checks now" button for demos |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` (preferred; free tier allows commercial use) | Fallback: Vercel Hobby (fast, but its terms say non-commercial) |

Previously evaluated and later candidates: WhatsApp Business Cloud API (production messaging), Sarvam AI STT ₹30/hour (production Hindi), Cloudflare R2 for media at scale, Supabase Pro at launch.

## Auth (demo)

- Office: shared `OFFICE_PIN` → signed httpOnly cookie. Replace with Supabase Auth per user after approval.
- Doctor report: unguessable `projects.report_token` in the URL.
- Telegram: webhook protected by `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`; people link via `/start <link_code>`.
- Server talks to Supabase with the **secret key** (server-only). RLS is enabled on every table with no policies, so the publishable/anon key can read nothing.

## Data model (applied, see `supabase/migrations/20261030000000_core_schema.sql`)

- `people` (role: coordinator | supervisor | procurement | head | doctor; `telegram_chat_id`; `link_code`; `current_project_id`)
- `templates`, `template_tasks` (phase, trade, zone, start_day, duration_days), `template_materials` (lead_time_days, need_day)
- `projects` (code like DM-0142, name, city, template, doctor/supervisor/coordinator, start_date, planned_days, status, order_notes, `report_token`, `last_report_sent_on`)
- `tasks` (phase, trade, zone, planned dates, status todo|doing|done|blocked, source template|learned|ai|manual)
- `materials` (lead_time_days, need_by, **generated `order_by`**, status to_order|ordered|received|issue, ordered_at/received_at, alert_sent_at/escalated_at, source)
- `updates` (kind photo|voice|text|location|video, media_path, raw_text, transcript, note, trade, zone, is_issue, suggested_routes[], suggested_action jsonb, ai_confidence, final_routes[], status pending|approved|held, auto_routed)
- `decisions` (doctor questions; answer approved|change)
- `app_settings` (`autopilot` = `{"enabled": false, "min_confidence": 0.9}`)

Still to add (workstream 0): `reseed_demo()` SQL function, views `learned_lead_times` and `learned_tasks` (create with `security_invoker = true`), and the pg_cron job once the app URL is known.

`suggested_action` shapes:
```json
{"type": "material_status", "material_id": "<uuid>", "status": "received|issue", "note": "2 broken, reorder"}
{"type": "task_status", "task_id": "<uuid>", "status": "done|doing|blocked"}
{"type": "phase_done", "phase": "Services"}
```

## Suggested layout

```
app/                 routes (see product spec table)
app/api/telegram/    webhook
app/api/cron/        daily checks (alerts, escalation, doctor reports)
lib/db.ts            Supabase server client (secret key)
lib/messaging/       Channel interface + telegram.ts (send text/photo, buttons, getFile)
lib/ai/              classify.ts, transcribe.ts, fallback.ts, prompts
lib/planner.ts       template → tasks/materials, learned suggestions
lib/routing.ts       approve/apply action/notify; autopilot
lib/report.ts        doctor report data
styles/tokens.css    Tensor tokens
supabase/migrations/
```

## Env

See `.env.example`. Keep `.env.local` out of git.

## Network notes

- Telegram webhooks need a public HTTPS URL. Locally, use long polling (a small `scripts/poll.ts` that calls `getUpdates` and forwards to the same handler) or a tunnel.
- Register the webhook after deploy: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>`.
