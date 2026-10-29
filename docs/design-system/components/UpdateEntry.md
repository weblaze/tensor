# UpdateEntry

One site update: a photo, one line, and where it happened. It is the unit of the doctor's nightly report and of the site timeline.

Order inside `article.tn-entry`: head (`tn-entry__num` in mono, a trade tag, a zone tag, `tn-entry__time` right-aligned), the 4:3 photo with its burned-in `tn-entry__stamp`, the note (`tn-entry__note`, one line, no full stop), then who and where (`tn-entry__who`: "Name · Floor · Room").

The consumer provides the photo as an `<img>` filling `tn-entry__photo` with `object-fit: contain` so photos stay uncropped, letterboxed on `surface-sunken`. Number, time and stamp come from the record, never typed.
