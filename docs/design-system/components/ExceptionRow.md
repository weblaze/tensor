# ExceptionRow

A row on the office or Prashant's screen for something that needs a person. Rows sit in a `tn-list`, overdue first, then attention, oldest first within each.

Each row: a status tag, then what is wrong (`tn-exc__what`, the item and the problem), then site · person · date (`tn-exc__meta`, dates in `tn-data`), then one action button that resolves it (Escalate, Call, Remind, Order).

When a site has nothing, show one `tn-clear` line with a check: "Muzaffarpur — nothing needs you." Never pad the screen with healthy rows.
