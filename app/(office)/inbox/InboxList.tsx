"use client";
import { useState } from "react";
import { ReviewCard, type ReviewItem } from "./ReviewCard";
import { Clear } from "@/components/ui";
import { Icon } from "@/components/Icon";

// Keeps the last confirmation visible after the reviewed card leaves the list.
export function InboxList({ items, headName }: { items: ReviewItem[]; headName: string }) {
  const [last, setLast] = useState<string | null>(null);
  return (
    <>
      {last ? (
        <div className="flash" role="status" aria-live="polite">
          <Icon name="check" />
          <span>{last}</span>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="tn-list"><Clear>Nothing waiting. New site updates will appear here.</Clear></div>
      ) : (
        items.map((it, i) => <ReviewCard key={it.id} item={it} index={i} headName={headName} onDone={(m) => setLast(`${it.note} — ${m}`)} />)
      )}
    </>
  );
}
