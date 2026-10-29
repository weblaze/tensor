# Build plan for parallel agents

Target: a working demo in 15 days on free tiers, piloted on one site.

## Ownership rules

- **WS0 runs first and alone.** It sets the contracts every other workstream depends on.
- Only the WS0/lead agent writes migrations. Others ask for schema changes in a note at the top of their PR/branch.
- Shared contracts live in `lib/types.ts`, `lib/messaging/index.ts`, `lib/ai/index.ts`. Change them only with the lead's agreement.
- One branch per workstream; merge into `main` through the lead.
- Every workstream ends with `npm run typecheck` and `npm run build` passing.

## WS0 — Foundation (lead, day 1–3)

- `create-next-app` (TS, App Router, no Tailwind), `styles/tokens.css` + base components from `docs/04-design-system.md`, IBM Plex via `next/font/google`.
- `lib/db.ts` (supabase-js with secret key, server-only), PIN login + middleware, app shell (top bar with Tensor mark, nav: Today, Inbox, Projects, People, Settings).
- Migration 2: views `learned_lead_times`, `learned_tasks` (`security_invoker = true`); `reseed_demo()` function (spec below); run Supabase advisors and fix findings.
- Interfaces: `Channel` (sendText, sendPhoto, sendButtons, downloadFile), `AI` (transcribe, classify, suggestPlan) with fallback implementations.
- Cloudflare deploy config (`@opennextjs/cloudflare`, `wrangler.jsonc`), verify `opennextjs-cloudflare build`.

## WS1 — Planner (day 4–8)

`/projects/new`: template picker, client/doctor, city, supervisor, start date, order notes → preview tasks (by phase) and materials (with order-by dates and "order by" warnings if already past) → mark learned/AI suggestions → create. `/projects/[id]` tasks and materials tabs with one-tap status changes (Mark ordered, Mark received, Issue).

## WS2 — Telegram intake + AI (day 4–8)

`/api/telegram` webhook: `/start CODE` linking; photo (largest size) + caption, text, voice (ogg → Gemini audio), location; site resolution with inline buttons when ambiguous; upload media to `site-media/<project>/<yyyy-mm-dd>/<id>.<ext>`; classify with context (project's open tasks + materials + last 15 reviewed updates as few-shot); store `updates` row; reply "Logged for <site> · <trade>. Office will review." in English + Hindi. `scripts/poll.ts` for local dev.

## WS3 — Office screens (day 6–12)

`/inbox` review cards (signed photo URL, note, tags editable, route toggles, suggested action, Approve / Hold, keyboard shortcuts), autopilot meter and toggle. `/` exceptions-first dashboard + project cards with DayCounter. `/people` with link codes and `t.me/<bot>?start=<code>` links.

## WS4 — Outputs (day 8–13)

`lib/routing.ts` approve → apply action → notify procurement/head on Telegram. `/r/[token]` doctor report (match the benchmark in `docs/01`, plus Day X of Y and decisions with Approve / Request change). `/api/cron`: procurement alerts (order-by ≤ today+2, `to_order`, not alerted), escalation (alerted > 24 h ago, still `to_order` → head), nightly doctor report send (21:00 IST, skip if no approved items), quiet-site detection. pg_cron job hourly calling `/api/cron`.

## WS5 — QA, deploy, demo (day 13–15)

Seed reset, end-to-end run with two phones (supervisor + doctor) and one laptop (coordinator), fix, deploy, register webhook, write `docs/demo-script.md` from the outline below.

## `reseed_demo()` spec

All dates relative to `current_date` so the demo always looks live. Truncate demo tables (keep `people.telegram_chat_id` links by matching on name if possible), then insert:

- Template "IVF lab — standard fit-out", 45 days.
  - Tasks (phase · title · trade · zone · start_day · days): Site setup · Site survey and marking · Civil · general · 0 · 2; Site setup · Demolition and debris removal · Civil · general · 1 · 3; Services · Electrical conduit rough-in · Electrical · general · 4 · 5; Services · MGPS copper piping · MGPS · critical · 6 · 5; Services · Ducting installation · HVAC · critical · 8 · 6; Build · Gypsum partitions and ceiling · Civil · general · 10 · 7; Build · Modular OT wall panels · Panelling · critical · 16 · 6; Build · Glass partitions, embryology lab · Glazing · critical · 18 · 3; Finishes · Epoxy flooring, OT and lab · Flooring · critical · 22 · 4; Finishes · Vinyl flooring, reception · Flooring · general · 24 · 3; Finishes · Sanitary fittings · Sanitary · general · 26 · 3; Finishes · Hermetic doors · Doors · critical · 28 · 2; HVAC · AHU installation · HVAC · critical · 24 · 5; HVAC · HEPA filters and validation · HVAC · critical · 34 · 3; Handover · Cryostorage room fit-out · Panelling · critical · 32 · 4; Handover · Deep clean and snag list · Civil · general · 40 · 3; Handover · Handover to client · Coordination · general · 44 · 1.
  - Materials (item · trade · qty unit · lead · need_day): Gypsum boards · Civil · 120 sheets · 4 · 10; MGPS copper pipes · MGPS · 1 set · 10 · 6; GI ducting · HVAC · 1 set · 7 · 8; Modular OT wall panels · Panelling · 1 set · 21 · 16; Glass partition panels · Glazing · 6 panels · 10 · 18; Cleanroom LED lights · Electrical · 24 fixtures · 12 · 20; Epoxy flooring kit · Flooring · 1 kit · 7 · 22; Vinyl flooring · Flooring · 80 sqm · 7 · 24; AHU unit · HVAC · 1 unit · 28 · 24; Sanitary fittings · Sanitary · 1 set · 5 · 26; Hermetic doors · Doors · 3 doors · 18 · 28; HEPA filters · HVAC · 8 filters · 14 · 34.
- People: Abhay (coordinator), Om and Rinku (supervisors), Anil (procurement), Prashant (head), Dr. Gunjan and Dr. Mehta (doctors). Mark them as demo data in the UI.
- Past projects (closed, for learning): DM-0131 Kawardha (start −90) and DM-0136 Rourkela (start −70), all tasks done, materials received with real lead times longer than template (glass 13, AHU 32, OT panels 24, hermetic doors 21); both include a manual task "MGPS pressure test" (Services, MGPS, critical, day 11) → becomes a learned suggestion; only Kawardha has "Fire NOC inspection" → not learned.
- Active DM-0142 Gunjan IVF, Sonipat (start −19 = Day 20 of 45; supervisor Om; doctor Dr. Gunjan): tasks ending before day 18 done, glass partitions doing, one task 2 days late. Materials: earlier ones received; Glass partition panels ordered; AHU ordered; Epoxy ordered; Cleanroom lights ordered; Vinyl ordered; **Hermetic doors to_order (order-by 9 days ago → overdue)**; **HEPA filters to_order (order-by tomorrow)**; **Sanitary fittings to_order (order-by in 2 days)**.
- Active DM-0145 Bhopal Fertility Clinic (start −6; supervisor Rinku; doctor Dr. Mehta): first tasks done; last update 2 days ago → quiet site.
- Updates for Gunjan: approved for doctor today: "Epoxy base coat done in OT, second coat tomorrow" (Flooring, critical); "AHU base frame installed" (HVAC, critical, doctor + head). Pending in inbox: "Glass panels received, 2 broken, please reorder" (Glazing, critical, issue; suggest procurement + head; action material_status issue on Glass partition panels); "Phase 1 complete" (suggest doctor + head; action phase_done Services); "Labour short today, 3 men absent" (suggest head only).
- Decision for Gunjan: "Approve OT wall finish: white antimicrobial HPL", asked 2 days ago, unanswered.
- `app_settings.autopilot` back to disabled.

## Demo script (outline)

1. Head's screen: overdue hermetic doors, HEPA order-by tomorrow, Bhopal quiet, 3 updates waiting.
2. Planner: create a new project from the template; show learned "MGPS pressure test" and learned lead times; order-by dates computed.
3. Supervisor phone: send a photo "glass received 2 broken" or a Hindi voice note to the bot; bot confirms.
4. Coordinator inbox: suggestion appears (procurement + head, material issue); approve in one click; Anil's phone gets the alert.
5. Doctor phone: open tonight's report; approve the OT wall finish.
6. Settings: autopilot meter — "suggests today, takes over when trusted".
