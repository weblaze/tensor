# Tensor

Operations system for Design Matrix: planner → supervisor updates on Telegram (WhatsApp later) → AI sorting → coordinator review → doctor report, procurement alerts and an exceptions-first view for the head.

Prototype on free tiers. Start with `CLAUDE.md`, then `docs/08-setup-checklist.md`, then `docs/09-run-and-deploy.md`.

```
cp .env.example .env.local   # fill in values; TENSOR_FIXTURE=1 runs without Supabase
npm install
npm run dev                  # http://localhost:3000
npm run poll                 # optional: Telegram bot on localhost
```

## Map

| Path | What |
|---|---|
| `app/(office)/` | Office web app: Today, Inbox, Projects, Planner, People, Settings; server actions in `actions.ts` |
| `app/r/[token]/` | Public doctor report with decisions |
| `app/api/telegram/` | Telegram webhook → `lib/intake.ts` |
| `app/api/cron/` | Hourly checks → `lib/cron.ts` |
| `lib/messaging/` | Channel interface; `telegram.ts` is the prototype adapter |
| `lib/ai/` | Transcribe, classify, suggest plan; Gemini with keyword fallback |
| `lib/planner.ts` | Template → tasks and materials, learned tasks and lead times |
| `lib/routing.ts` | Approve / hold, apply actions, notify, autopilot |
| `lib/insights.ts` | Day X / Y, slip, exceptions |
| `lib/report.ts` | Doctor report data and sending |
| `lib/fixture/` | Dev-only in-memory demo data |
| `supabase/migrations/` | Schema, learning views, `reseed_demo()` |
| `docs/demo-script.md` | The 12-minute demo |
