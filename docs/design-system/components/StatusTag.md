# StatusTag

The state of a task, item or site, always as an icon plus words that include the number: "Overdue 1 day", never just "Late".

- `tn-tag`: neutral (done, not started). Done is grey with a check, never green.
- `tn-tag tn-tag--attention`: will go wrong if nobody acts (order-by date tomorrow, site quiet).
- `tn-tag tn-tag--overdue`: already wrong (date passed, alert unacknowledged after 24h).
- `tn-tag tn-tag--trade`: the trade of an update (Sanitary, Flooring, HVAC), outlined so it never reads as a status.

The consumer provides the icon (16px, class `tn-ico tn-ico--sm`) and the text. One status tag per row.
