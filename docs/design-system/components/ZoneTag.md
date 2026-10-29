# ZoneTag

Marks whether a room or update belongs to the critical zone (OT, embryology lab, cryo, collection) or the general zone (reception, waiting, consult). Write "Zone · Room".

- `tn-zone tn-zone--critical`: `scrub` on `scrub-soft`.
- `tn-zone tn-zone--general`: `stone` on `stone-soft`.

The square before the text is drawn by CSS. Every update entry and every room carries exactly one zone tag; zone is never shown by colour alone.
