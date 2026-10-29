"use client";
import { useRef, useState, useTransition } from "react";
import { approveUpdateAction, fileUpdateAction, holdUpdateAction, type ReviewResult } from "../actions";
import { Icon } from "@/components/Icon";
import { TRADES, type RouteTarget, type Zone } from "@/lib/types";

export interface ReviewItem {
  id: string;
  kind: "photo" | "voice" | "text" | "location" | "video";
  note: string;
  raw: string | null;
  transcript: string | null;
  trade: string | null;
  zone: Zone | null;
  isIssue: boolean;
  suggested: RouteTarget[];
  confidence: number | null;
  actionLabel: string | null;
  site: string | null;
  code: string | null;
  who: string | null;
  when: string;
  stamp: string;
  mediaUrl: string | null;
  lat: number | null;
  lng: number | null;
  offered?: { id: string; label: string }[];
}

const ROUTE_LABEL: Record<RouteTarget, string> = { doctor: "Doctor", procurement: "Procurement", head: "Prashant" };
const ROUTE_HELP: Record<RouteTarget, string> = {
  doctor: "Tonight's report",
  procurement: "Telegram now",
  head: "Telegram now",
};

export function ReviewCard({ item, index, onDone }: { item: ReviewItem; index: number; onDone?: (message: string) => void }) {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function run(fn: (f: FormData) => Promise<ReviewResult>) {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    start(async () => {
      const res = await fn(fd);
      setResult(res);
      if (res.ok) onDone?.(res.message);
    });
  }

  if (result?.ok) {
    return (
      <div className="card" role="status" style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink-muted)" }}>
        <Icon name="check" />
        <span>{item.note} — {result.message}</span>
      </div>
    );
  }

  const unfiled = !item.code;

  return (
    <article className="card review" data-review-card={index} tabIndex={-1} aria-label={`Update ${index + 1}: ${item.note}`}>
      <div className="stack-2">
        <div className="photo">
          {item.mediaUrl && item.kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.mediaUrl} alt={item.note} />
          ) : item.mediaUrl && item.kind === "video" ? (
            <video src={item.mediaUrl} controls preload="metadata" />
          ) : (
            <div className="photo__empty">
              <Icon name={item.kind === "voice" ? "mic" : item.kind === "location" ? "pin" : item.kind === "text" ? "text" : "camera"} />
              {item.kind === "voice" && item.mediaUrl ? <audio src={item.mediaUrl} controls preload="none" style={{ maxWidth: "100%" }} /> : null}
              {item.kind === "location" && item.lat !== null ? (
                <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer">Open map</a>
              ) : null}
              {!item.mediaUrl && item.kind === "photo" ? <span>Photo not stored in demo data</span> : null}
              {item.kind === "text" ? <span>Text message</span> : null}
            </div>
          )}
          <span className="tn-entry__stamp">{item.stamp}</span>
        </div>
        <span className="tn-caption">{item.who ?? "Unknown"} · {item.when}</span>
      </div>

      <form ref={formRef} className="review__body" onSubmit={(e) => { e.preventDefault(); run(approveUpdateAction); }}>
        <input type="hidden" name="id" value={item.id} />
        <div className="row-between">
          <div className="tn-row">
            {item.code ? <span className="tn-data tn-muted">{item.code}</span> : <span className="tn-tag tn-tag--attention"><Icon name="alert" size="sm" />Site unknown</span>}
            {item.site ? <span className="tn-body-strong">{item.site}</span> : null}
            {item.isIssue ? <span className="tn-tag tn-tag--overdue"><Icon name="alert" size="sm" />Issue</span> : null}
          </div>
          {item.confidence !== null ? (
            <span className="tn-caption" title="How sure Tensor is that you will accept this unchanged">
              Sure <span className="tn-data">{Math.round(item.confidence * 100)}%</span>
            </span>
          ) : null}
        </div>

        <p className="review__note">{item.note}</p>
        {item.raw && item.raw.toLowerCase() !== item.note.toLowerCase() ? (
          <p className="review__raw">“{item.transcript ?? item.raw}”{item.kind === "voice" ? " · voice note" : ""}</p>
        ) : null}

        {unfiled ? (
          <div className="stack-2">
            <label className="tn-field">
              <span className="tn-label">Which site?</span>
              <select name="project_id" className="tn-input" defaultValue="">
                <option value="" disabled>Choose a site</option>
                {(item.offered ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <span className="tn-help">The supervisor did not pick a site. Filing it sorts it for review.</span>
            </label>
            <div className="review__buttons">
              <button type="button" className="tn-btn tn-btn--primary" disabled={pending} onClick={() => run(fileUpdateAction)}>File to site</button>
            </div>
          </div>
        ) : (
          <>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack-2">
              <legend className="tn-label" style={{ marginBottom: 8 }}>Send to</legend>
              <div className="chips">
                {(["doctor", "procurement", "head"] as RouteTarget[]).map((r) => (
                  <label key={r} className={`chip${item.suggested.includes(r) ? " chip--suggested" : ""}`} title={ROUTE_HELP[r]}>
                    <input type="checkbox" name="routes" value={r} defaultChecked={item.suggested.includes(r)} />
                    <span>{ROUTE_LABEL[r]}</span>
                  </label>
                ))}
              </div>
              <span className="tn-help">Procurement and Prashant get it on Telegram now. The doctor sees it in tonight&apos;s report.</span>
            </fieldset>

            {item.actionLabel ? (
              <label className="review__action check" style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <input type="checkbox" name="apply_action" value="on" defaultChecked onChange={(e) => {
                  const hidden = e.currentTarget.form?.querySelector<HTMLInputElement>("input[data-apply-off]");
                  if (hidden) hidden.disabled = e.currentTarget.checked;
                }} />
                <span className="stack-2" style={{ gap: 2 }}>
                  <span className="tn-stamp">Also do</span>
                  <span className="tn-body-strong">{item.actionLabel}</span>
                </span>
                <input type="hidden" name="apply_action" value="off" data-apply-off disabled />
              </label>
            ) : null}

            <details className="more">
              <summary>Edit note, trade or zone</summary>
              <div className="stack-4" style={{ paddingTop: 8 }}>
                <label className="tn-field">
                  <span className="tn-label">Note</span>
                  <input className="tn-input" name="note" defaultValue={item.note} maxLength={160} />
                </label>
                <div className="review__edit">
                  <label className="tn-field">
                    <span className="tn-label">Trade</span>
                    <select className="tn-input" name="trade" defaultValue={item.trade ?? ""}>
                      <option value="">None</option>
                      {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="tn-field">
                    <span className="tn-label">Zone</span>
                    <select className="tn-input" name="zone" defaultValue={item.zone ?? ""}>
                      <option value="">Not set</option>
                      <option value="critical">Critical</option>
                      <option value="general">General</option>
                    </select>
                  </label>
                </div>
              </div>
            </details>

            <div className="review__buttons">
              <button type="submit" className={index === 0 ? "tn-btn tn-btn--primary" : "tn-btn"} disabled={pending} data-approve>
                <Icon name="check" />
                {pending ? "Saving" : "Approve"}
              </button>
              <button type="button" className="tn-btn" disabled={pending} onClick={() => run(holdUpdateAction)} data-hold>
                <Icon name="pause" />
                Hold
              </button>
            </div>
          </>
        )}
        {result && !result.ok ? <p className="tn-help" style={{ color: "var(--alert)" }}>{result.message}</p> : null}
      </form>
    </article>
  );
}
