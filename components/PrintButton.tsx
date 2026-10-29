"use client";
import { Icon } from "./Icon";

export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="tn-btn tn-btn--quiet no-print" onClick={() => window.print()}>
      <Icon name="file" />
      {label}
    </button>
  );
}
