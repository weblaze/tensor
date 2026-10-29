# Product spec

## The flow (as pitched)

1. **Coordinator plans.** When an order comes in, the coordinator creates the project in the planner: pick a template ("IVF lab — standard fit-out"), client/doctor, city, supervisor, start date, order notes. Tensor generates tasks (phase, trade, zone, planned dates) and materials (qty, lead time, need-by, **order-by = need-by − lead time**). This becomes the supervisor's plan.
   - **Learns as it is used:** tasks that coordinators added by hand in 2+ past projects of the same template are suggested ("learned"); lead times are replaced by the actual average from past deliveries (received − ordered) when available. Optional "Suggest with AI" reads the order notes and proposes extra tasks/materials. Every suggestion is shown as such and can be removed before creating.
2. **Supervisor sends.** Photo + caption, text, Hindi voice note, or location to the Telegram bot. First time: `/start <link code>` links their chat to their person record. Site is resolved from their active project (if several, the bot asks with buttons and remembers).
3. **Tensor sorts it.** Stores media, transcribes voice, writes a clean one-line English note, tags trade and zone, flags issues, matches it to a task or material (e.g. "glass panels received, 2 broken" → material Glass partition panels → status issue, note "2 broken, reorder"), and suggests routes: `doctor`, `procurement`, `head` (any subset, or none). Few-shot examples come from the coordinator's last reviewed decisions, so suggestions improve.
4. **Office confirms.** Coordinator inbox: one card per update with photo, note, tags, suggested routes as toggles and the suggested action. Approve (one click) or Hold. Approval applies the action, sends procurement/head messages on Telegram immediately, and queues doctor-routed items for the nightly report.
   - **Autopilot meter:** % of suggestions accepted unchanged over the last 50 reviews. When high, the coordinator can enable autopilot for high-confidence items (setting `app_settings.autopilot`). Default off.
5. **Outputs.**
   - **Doctor report** (`/r/<report_token>?date=YYYY-MM-DD`): public, no login, mobile-first, Tensor styling, approved doctor-routed updates for the day, Day X of Y, filter by trade, pending decisions with Approve / Request change buttons. Sent at ~9 pm via Telegram (if the doctor is linked) or the coordinator copies the link.
   - **Procurement alerts**: materials whose order-by date is within 2 days and status `to_order` → Telegram to procurement. Unacknowledged for 24 h (still `to_order`) → escalate to head.
   - **Head's view**: exceptions first: overdue order-by, order-by soon, quiet sites (no update today), issues, pending doctor decisions, items waiting for review. Healthy sites collapse to one line.

## Screens (office web app)

| Route | Who | Purpose |
|---|---|---|
| `/login` | office | Shared PIN (demo only) |
| `/` | head, coordinator | Exceptions first + project cards with Day X / Y |
| `/inbox` | coordinator | Review and route updates; autopilot meter |
| `/projects/new` | coordinator | Planner |
| `/projects/[id]` | office | Tasks by phase, materials with order-by and status buttons, approved timeline, report link, "send report now" |
| `/people` | coordinator | People, roles, Telegram link codes / deep links |
| `/settings` | coordinator | Autopilot toggle, "Run daily checks now", "Reset demo data" |
| `/r/[token]` | doctor | Daily report (public) |

## In the demo vs later

In: everything above.

Later (do not build now, do not pitch now):
- WhatsApp Business Cloud API (replace Telegram adapter), Sarvam STT for Hindi in production.
- Concealed-work map (photos of pipes/wiring before walls close, pinned per room).
- Vendor memory (vendor, price, real lead time by city).
- Build timelapse per room; handover pack into VeriART-Tec.
- Company-wide modules: sales/leads, quotations and order generation, finance, design approvals, service/complaints, HR/expenses.
- Real auth per user (Supabase Auth), roles and audit log.

## Design principles

- Invisible design: every feature removes a step someone already takes; reuse data for a second purpose.
- Any AI guess (site, trade, zone, route, action) is correctable in one tap.
- Status is always a word plus an icon, never colour alone.
- Photos are evidence: shown uncropped with a burned-in time/site stamp.
