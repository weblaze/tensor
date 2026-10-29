"use client";
import { useEffect } from "react";

// A approves the top card, H holds it. Ignored while typing in a field.
export function Shortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      const key = e.key.toLowerCase();
      if (key !== "a" && key !== "h") return;
      const btn = document.querySelector<HTMLButtonElement>(key === "a" ? "[data-approve]:not([disabled])" : "[data-hold]:not([disabled])");
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
