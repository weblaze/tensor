# Tensor design system

Live brand book (Claude Design, private to Arunav): https://claude.ai/artifact/7Niryvsd9asDXnRVCfUdUc

Direction: **clinical precision**, designed for internal staff first (supervisors on dusty phones in sunlight, then office on desktop). Cool, exact, quiet. Quiet when things are fine; colour only for what needs a person.

## Colour tokens (light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| surface | #f6f7f6 | #0f1312 | Page background |
| surface-raised | #ffffff | #171c1b | Cards, entries, inputs |
| surface-sunken | #eceeed | #0a0d0c | Wells, photo placeholders, tracks |
| line | #d9dedc | #2a3230 | Hairlines (decorative) |
| line-strong | #86918e | #66726f | Input / secondary button borders |
| ink | #111816 | #e8eeec | Primary text |
| ink-muted | #56625e | #9aa7a3 | Secondary text |
| scrub | #0e6b5c | #3fc3a8 | Brand, primary action, critical zone |
| scrub-soft | #dcefe9 | #11302a | Tint behind scrub text |
| on-scrub | #ffffff | #04211b | Text on scrub fill |
| signal | #9c4f00 | #f0a43c | Attention (will go wrong if nobody acts) |
| signal-soft | #fbecd6 | #36230a | |
| alert | #b8321c | #ff7f63 | Overdue / escalated |
| alert-soft | #fbe3dd | #3b1811 | |
| on-alert | #ffffff | #1f0805 | |
| stone | #6e5f4b | #c7b79f | General zone |
| stone-soft | #efe9e0 | #2a251e | |
| focus | = scrub | = scrub | 2px ring, 2px offset |

All text pairs pass 4.5:1 in both themes. Light theme is default.

## Type

IBM Plex throughout (Google Fonts): Plex Sans (+ Plex Sans Devanagari fallback for Hindi) for text, Plex Mono for data.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| display | 40/44 | 600 | Project name, report header (once per screen) |
| title | 24/30 | 600 | Screen titles |
| heading | 18/24 | 600 | Sections |
| body | 16/24 | 400 | All reading text, never smaller on phone |
| body-strong | 16/24 | 500 | Row subject |
| label | 14/20 | 500 | Labels, tags, small buttons |
| caption | 13/18 | 400 | Who · where |
| data | 14/20 mono | 400 | Times, IDs, quantities, dates (tabular) |
| data-lg | 28/32 mono | 500 | Counts, Day X / Y |
| stamp | 12/16 mono, uppercase, 0.06em | 500 | Eyebrows, burned-in photo stamp |

## Space, size, shape

4px grid: 4, 8, 12, 16, 24, 32, 48, 64. Phone gutter 16, desktop 32. Tap target min 48px; list row 56px; phone bottom action bar 64px. Radius 2 (tags), 4 (buttons, inputs), 6 (cards, photos); nothing pill-shaped. Cards separate by 1px `line`, no shadow; shadow only on sheets/menus.

## Components (CSS classes, prefix `tn-`)

Button (`tn-btn`, `--primary` once per screen, `--quiet`, `--alert` for Escalate only), StatusTag (`tn-tag` neutral/done grey with check, `--attention`, `--overdue`, `--trade` outlined), ZoneTag (`tn-zone--critical` scrub, `--general` stone), Field, UpdateEntry (head: number, trade, zone, time; 4:3 photo with stamp; one-line note; who · floor · room), ExceptionRow (status tag, what's wrong, site · person · date, one resolving action; "nothing needs you" line when clear), DayCounter ("Day 20 / 45", one segment per planned day, done / late / remaining).

## Voice

Plain, short, verb-first ("Order glass", "Mark received", "Escalate"). Sentence case, no exclamation marks, no emoji. Say what and by when with a number. 12-hour times ("5:37 PM"), dates "9 Sep 2026". Staff copy terse; doctor-facing copy calmer and fuller. Keep labels ≤ 2 words so Hindi fits.

## Mark

3×3 grid of cells, eight in ink, one (top-right) in scrub: one record per site, only the exception speaks. Wordmark "Tensor" set live in Plex Sans 600.

Note: the pitch deck uses the **Numinds** design system (teal #248D9B / #0E3941, yellow #FFF32C, Outfit + Source Sans 3) because Numinds presents it. The product UI uses Tensor.
