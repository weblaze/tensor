# Tensor

Tensor is the operations system for **Design Matrix**, a turnkey IVF clinic fit-out contractor (Arunav's father Rajeev is a director; Prashant is the owner and the "head" in the product). We are building a **functional prototype** to get it approved. After approval, real accounts (WhatsApp Business, paid tiers, company domain) get plugged in.

The owner of this repo is Arunav Ganguly. He works with multiple Claude Code agents in parallel.

## Read before working

1. `docs/01-business-context.md`: who the users are, how they work today, what hurts.
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

- Supabase project `tensor` created (ref `gwgthatwoxuggidblodi`, region ap-south-1, free tier) and `supabase/migrations/20261030000000_core_schema.sql` is **already applied** there. Storage bucket `site-media` (private) exists.
- Not yet done: seed/reset function, learning views, the Next.js app, Telegram bot, Gemini key, hosting, GitHub repo. Start with workstream 0 in `docs/06-build-plan.md`.
- Superseded and to be ignored: an earlier attempt (GitHub `weblaze/ops-tracker`, paused Supabase project `ops-tracker`) and the Google Forms + Sheets track.
