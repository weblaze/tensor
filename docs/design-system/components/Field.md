# Field

A labelled input, 48px tall. The label sits above, always visible (no placeholder-only labels); helper text below says where the value comes from.

Markup: `label.tn-field > span.tn-label + input.tn-input + span.tn-help`. For an error add `tn-field--error` and replace the helper with what to do next, starting with a warning icon.

Use the right keyboard: `inputmode="numeric"` for quantities. Prefer taps (choices, photos, voice) over typing on site; a typed field is the last resort.
