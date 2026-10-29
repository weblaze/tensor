# Button

A command, 48px tall at minimum. Write the label as a verb first, two words where possible: "Add update", "Mark received".

- `tn-btn tn-btn--primary`: the one thing the screen is for. At most one per screen; on phones it lives in the bottom `bar`.
- `tn-btn`: secondary actions.
- `tn-btn tn-btn--quiet`: navigation and low-stakes actions in rows.
- `tn-btn tn-btn--alert`: Escalate only. Never for delete (deleting is a quiet action behind a confirm).
- Add `tn-btn--block` for full width on phones. An icon goes before the label as an inline SVG with class `tn-ico`.

The consumer provides the `<button>` element, its label and its handler. Disabled buttons say why nearby; don't leave a dead button unexplained.
