Tensor is the operations system for Design Matrix: one record per clinic build, from lead to handover. It is used first by site supervisors on phones, often outdoors and in Hindi, then by the office and Prashant on desktop. The brand is clinical precision: cool, exact, quiet. It should feel like the instruments in the rooms Design Matrix builds, never like a dashboard trying to impress.

## Principles

- **Quiet when things are fine.** A screen with nothing wrong is nearly empty. Colour is spent only on what needs a person: `signal` for attention, `alert` for overdue. Done work goes grey (`ink-muted` with a check), not green.
- **Field first.** Design for a supervisor on a dusty phone in sunlight. Every tappable thing is at least `tap-min` (48px); body text never drops below `body` (16px); light theme is the default.
- **Evidence over description.** Photos with burned-in time and place outrank text. A note is one line.
- **Exact.** Times, quantities, IDs and dates are set in `data` (mono, tabular) so columns line up and nothing is ambiguous.

## Voice

- Plain, short, verb-first: "Order glass", "Mark received", "Escalate". Sentence case everywhere; no exclamation marks, no emoji.
- Say what and by when, with a number: "Glass for OT partition · order by 31 Oct", not "Glass needs attention".
- Name people by first name and place by site, floor and room: "Om · Ground floor · OT".
- Times in 12-hour with AM/PM ("5:37 PM"); dates as "9 Sep 2026". Durations as "Day 20 of 45", "Overdue 1 day".
- Every screen string must have a Hindi version of similar length. Keep English labels to two words where possible so the Hindi fits the same space.
- Doctor-facing copy is calmer and fuller ("Your OT panels were installed today"); staff copy is terse.

## Colour

- Ground is `surface`; cards and entries are `surface-raised` with a 1px `line` border, no shadow. `surface-sunken` is for wells (photo placeholders, tracks).
- Text is `ink` or `ink-muted`, nothing else, except a status or zone word inside its own tag.
- `scrub` is the brand and the primary action: at most one `scrub`-filled button per screen. It also marks the critical zone (OT, embryology lab, cryo, collection room).
- `stone` marks the general zone (reception, waiting, consult, interiors). Cool `scrub` against warm `stone` is how the two zones read apart at a glance.
- Status uses three steps only: neutral (`ink-muted`), attention (`signal` on `signal-soft`), overdue (`alert` on `alert-soft`). A status is always a word plus an icon, never colour alone: `signal` and `alert` are close in lightness, and `scrub` and `alert` sit on the red–green axis.
- Text on a `scrub` fill is `on-scrub`; on an `alert` fill, `on-alert`. Never literal white.
- Focus is a 2px solid `focus` ring with a 2px offset on every interactive element.

## Type

- One superfamily: IBM Plex. `sans` (Plex Sans, falling back to Plex Sans Devanagari) for all text in English and Hindi; `mono` (Plex Mono) for data. Load both from Google Fonts.
- Use `display` at most once per screen, `title` for screen titles, `heading` for sections, `body` for everything people read, `body-strong` for the subject of a row, `label` for labels and tags, `caption` for who and where.
- Use `data` for every time, date, ID and quantity; `data-lg` for counts; `stamp` (uppercase mono) for eyebrows and the time and place burned onto photos.

## Space, size and shape

- 4px grid: `space-1` to `space-8`. Phone gutter `space-4`, between cards `space-5`; desktop gutter `space-6`.
- List rows are `row` (56px); the phone action bar is `bar` (64px), pinned to the bottom, holding the one primary action.
- Corners are small: `radius-xs` for tags, `radius-sm` for buttons and inputs, `radius-md` for cards and photos. Nothing is pill-shaped.
- Shadows only on sheets and menus (`shadow-sheet`). Everything else separates by `line`.

## Photos and imagery

- Photos are records, shown uncropped at 4:3 with `radius-md`, no filters. The capture time and site are burned into the bottom-left in `stamp` on a 60% black band, so a forwarded photo still carries its proof.
- No illustrations, stock photos or decorative graphics anywhere in the product.

## Iconography

- No icon set is chosen yet; until one is, use a 1.5px-stroke outline set drawn on a 24px grid with square caps, at 20px beside text. Icons take the colour of the text beside them.
- Icons carry meaning only alongside a word, never alone, except the close and back controls.

## Motion

- Functional only: 120ms ease-out for state changes and sheets. Nothing loops or bounces. Respect reduced-motion by turning transitions off.

## Logo

- The grid mark (`assets/Logos`) plus the word "Tensor" set live in `title` or `display`. On dark grounds use `tensor-mark-reverse.svg`.

## Components

Components are CSS classes in `components/bundle.css`, prefixed `tn-`. Load `tokens.css` then `bundle.css`; there is no JavaScript bundle. Each component's README says which classes and markup to use.
