# Tensor

Tensor is the operations system for **Design Matrix**, a turnkey IVF clinic fit-out contractor (Arunav's father Rajeev is a director; Prashant is the owner and the "head" in the product). We are building a **functional prototype** to get it approved. After approval, real accounts (WhatsApp Business, paid tiers, company domain) get plugged in.

The owner of this repo is Arunav Ganguly. He works with multiple Claude Code agents in parallel.

## Read before working

1. `docs/01-business-context.md`: who the users are, how they work today, what hurts. (Local only: it and `docs/05-costs.md` are git-ignored because the repo is public. Ask Arunav if missing.)
2. `docs/02-product-spec.md`: the workflow and every feature, with what is in and out of the demo.
3. `docs/03-architecture.md`: stack, accounts, data model, env, conventions.
4. `docs/06-build-plan.md`: workstreams for parallel agents, ownership rules, demo script.

Also: `docs/04-design-system.md` (Tensor brand, use it for all UI), `docs/05-costs.md`, `docs/07-pitch-deck.md`, `docs/08-setup-checklist.md`.

## The workflow in one paragraph

An order comes in → the **office coordinator** sets up the project in Tensor's **planner** (tasks and materials from a template, with suggestions learned from past projects; material order-by dates computed from install dates and lead times) → **site supervisors** send a photo and a one-liner (or a Hindi voice note) on **Telegram** (prototype stand-in for WhatsApp) → Tensor files it to the project, transcribes it, tags trade and zone, and **suggests** who needs it (doctor, procurement, head) → the **coordinator confirms** in one click → procurement and the head are notified right away; the **doctor** gets a daily report (~9 pm) of approved updates. Routing starts as a suggester; once accuracy is proven the coordinator can switch on autopilot.

## Hard rules

- Supervisors are input-only. They are not technical and won't use an app. Never add steps for them beyond send photo / text / voice / location.
- Nothing reaches the doctor without coordinator approval in the demo (unless autopilot is explicitly enabled in settings).
- Low cognitive load everywhere: tap targets ≥ 48px, body text ≥ 16px, exceptions first, quiet screens when nothing is wrong.
- Free tiers only for the prototype. No paid services, no credit cards.
- Messaging and AI providers sit behind small interfaces (`lib/messaging`, `lib/ai`) so WhatsApp Cloud API and Sarvam can replace Telegram and Gemini later without touching features.
- Every AI call must have a non-AI fallback (keyword heuristics) so the demo works with no Gemini key and when the free quota runs out.
- Secrets live only in `.env.local` / host env. The Supabase secret key is server-only.
- The database schema is owned by one agent at a time (see build plan). New schema changes go in new files under `supabase/migrations/`; never edit an applied migration.

## Current state (2026-10-30)

- Supabase project `tensor` created (ref `gwgthatwoxuggidblodi`, region ap-south-1, free tier). Storage bucket `site-media` (private) exists.
- Applied migrations: `20261030000000_core_schema`, `20261030010000_learning_seed` (views `learned_lead_times`, `learned_tasks`, table `notifications`, `reseed_demo()`), `20261030020000_reseed_times`. Then `20261106000000_prod_hardening` (login_attempts, demo_mode guard on `reseed_demo()`, `reset_to_production()`), `..._fix_reset_to_production`, `..._reset_keeps_people`, `..._cron_extensions`, `..._advisor_fixes` (pg_net in `extensions`, FK indexes). All applied.
- Built (WS0–WS4): the Next.js 15 app with every screen in the product spec, Telegram intake + local poller, Gemini AI with keyword fallback, routing/autopilot, doctor report, hourly checks, Cloudflare Workers config (`opennextjs-cloudflare build` passes). See `docs/09-run-and-deploy.md` and `docs/demo-script.md`.
- Dev without a Supabase key: `TENSOR_FIXTURE=1` runs on in-memory demo data (`lib/fixture/`, dev only). Keep `lib/fixture/seed.ts` in step with `reseed_demo()`.
- Verified against live Supabase (2026-10-30): every screen, approve/hold, planner create, daily checks, doctor decisions, Telegram intake, private storage with signed URLs. Supabase secret key and the Telegram bot (@tensortestbot, commands and description set) are in the local `.env.local`.
- Production hardening (2026-11-06): demo reset and Demo badge only with `DEMO_MODE=1`; long office passphrase + login lockout; single-use Telegram link codes; edit/delete for tasks, materials, projects, people; template editor at Settings > Templates; Vitest unit tests + GitHub Actions CI. Public repo: github.com/weblaze/tensor.
- Deployed (2026-11-06): https://tensor.designmatrix.workers.dev (Cloudflare account arunav031@gmail.com, workers.dev subdomain `designmatrix`). Secrets uploaded from `.prod-secrets.json` (git-ignored; holds the office passphrase). Telegram webhook points at the live app. Deploy with `npm run deploy` (builds without local env files).
- Production database (2026-11-06): `reset_to_production()` ran: demo data and doctors removed, 5 staff kept with fresh link codes, demo mode off (`reseed_demo()` now refuses). pg_cron job `tensor-hourly` (minute 5) calls `/api/cron` with the Vault secret `tensor_cron_secret`; verified 200. Live Telegram intake verified end to end. Optional: Gemini key. A leftover test photo sits unreferenced in the `site-media` bucket.
- Superseded and to be ignored: an earlier attempt (GitHub `weblaze/ops-tracker`, paused Supabase project `ops-tracker`) and the Google Forms + Sheets track.
