"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export function CopyLink({ value, label = "Link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy">
      <input className="tn-input" readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="tn-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked; the field is selectable */
          }
        }}
      >
        <Icon name={copied ? "check" : "copy"} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
