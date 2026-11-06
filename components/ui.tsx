import { Icon } from "./Icon";
import { fmtDate, fmtShort, fmtTime, istDate, plural } from "@/lib/dates";
import type { Progress } from "@/lib/insights";
import type { MaterialStatus, Source, TaskStatus, UpdateKind, Zone } from "@/lib/types";

export function Mark({ size = 24, reverse = false }: { size?: number; reverse?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={reverse ? "/tensor-mark-reverse.svg" : "/tensor-mark.svg"} width={size} height={size} alt="" />;
}

export function StatusTag({ tone = "neutral", icon, children }: { tone?: "neutral" | "attention" | "overdue"; icon?: string; children: React.ReactNode }) {
  const cls = tone === "attention" ? "tn-tag tn-tag--attention" : tone === "overdue" ? "tn-tag tn-tag--overdue" : "tn-tag";
  const ico = icon ?? (tone === "overdue" ? "alert" : tone === "attention" ? "clock" : "check");
  return (
    <span className={cls}>
      <Icon name={ico} size="sm" />
      {children}
    </span>
  );
}

export function TradeTag({ trade }: { trade: string | null }) {
  if (!trade) return null;
  return <span className="tn-tag tn-tag--trade">{trade}</span>;
}

export function ZoneTag({ zone, room }: { zone: Zone | null; room?: string }) {
  if (!zone) return null;
  return (
    <span className={`tn-zone tn-zone--${zone}`}>
      {zone === "critical" ? "Critical" : "General"}
      {room ? ` · ${room}` : ""}
    </span>
  );
}

export function SourceTag({ source, why }: { source: Source; why?: string }) {
  if (source === "template" || source === "manual") return null;
  return (
    <span className={`src${source === "ai" ? " src--ai" : ""}`} title={why}>
      {source === "ai" ? "AI" : "Learned"}
    </span>
  );
}

const TASK_WORD: Record<TaskStatus, string> = { todo: "Not started", doing: "In progress", done: "Done", blocked: "Blocked" };
export function TaskStatusTag({ status, lateDays = 0 }: { status: TaskStatus; lateDays?: number }) {
  if (status === "blocked") return <StatusTag tone="overdue">Blocked</StatusTag>;
  if (status !== "done" && lateDays > 0) return <StatusTag tone="attention">Late {plural(lateDays, "day")}</StatusTag>;
  if (status === "done") return <StatusTag>Done</StatusTag>;
  return <StatusTag icon={status === "doing" ? "bolt" : "clock"}>{TASK_WORD[status]}</StatusTag>;
}

export function MaterialStatusTag({ status, daysToOrder }: { status: MaterialStatus; daysToOrder: number }) {
  if (status === "issue") return <StatusTag tone="overdue">Issue</StatusTag>;
  if (status === "received") return <StatusTag>Received</StatusTag>;
  if (status === "ordered") return <StatusTag icon="truck">Ordered</StatusTag>;
  if (daysToOrder < 0) return <StatusTag tone="overdue">Overdue {plural(-daysToOrder, "day")}</StatusTag>;
  if (daysToOrder === 0) return <StatusTag tone="attention">Order today</StatusTag>;
  if (daysToOrder <= 2) return <StatusTag tone="attention">{daysToOrder === 1 ? "Order tomorrow" : `Order in ${plural(daysToOrder, "day")}`}</StatusTag>;
  return <StatusTag icon="clock">To order</StatusTag>;
}

export function KindIcon({ kind }: { kind: UpdateKind }) {
  const map: Record<UpdateKind, [string, string]> = {
    photo: ["camera", "Photo"],
    voice: ["mic", "Voice"],
    text: ["text", "Text"],
    location: ["pin", "Location"],
    video: ["video", "Video"],
  };
  const [icon, word] = map[kind];
  return (
    <span className="tn-tag">
      <Icon name={icon} size="sm" />
      {word}
    </span>
  );
}

export function DayCounter({ progress, eyebrow = "Build progress" }: { progress: Progress; eyebrow?: string }) {
  const { day, planned, slip, handoverPlanned, handoverProjected } = progress;
  const shownDay = Math.max(0, day);
  const segs = Array.from({ length: planned }, (_, i) => {
    // Elapsed days split into on-plan progress and slip at the end of the elapsed run.
    const elapsed = Math.min(shownDay, planned);
    if (i < elapsed - slip) return "done";
    if (i < elapsed) return "late";
    return "";
  });
  return (
    <div className="tn-day">
      <span className="tn-day__eyebrow">{eyebrow}</span>
      <span className="tn-day__count">
        {day < 1 ? "Starts soon" : <>Day {shownDay} <span>/ {planned}</span></>}
      </span>
      <div className="tn-day__track" aria-hidden="true">
        {segs.map((s, i) => (
          <span key={i} className={`tn-day__seg${s ? ` tn-day__seg--${s}` : ""}`} />
        ))}
      </div>
      <span className="tn-day__note">
        {slip > 0
          ? `${plural(slip, "day")} behind plan · handover ${fmtShort(handoverPlanned)} → ${fmtShort(handoverProjected)}`
          : `On plan · handover ${fmtDate(handoverPlanned)}`}
      </span>
    </div>
  );
}

export function Photo({ url, kind, stamp, alt }: { url: string | null; kind: UpdateKind; stamp?: string; alt: string }) {
  return (
    <div className="photo tn-entry__photo">
      {url && kind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" />
      ) : url && kind === "video" ? (
        <video src={url} controls preload="metadata" />
      ) : url && kind === "voice" ? (
        <div className="photo__empty">
          <Icon name="mic" />
          <audio src={url} controls preload="none" style={{ maxWidth: "100%" }} />
        </div>
      ) : (
        <div className="photo__empty">
          <Icon name={kind === "voice" ? "mic" : kind === "location" ? "pin" : kind === "text" ? "text" : "camera"} />
          <span>{kind === "photo" ? "No photo" : kind === "voice" ? "Voice note" : kind === "location" ? "Location" : "Text message"}</span>
        </div>
      )}
      {stamp ? <span className="tn-entry__stamp">{stamp}</span> : null}
    </div>
  );
}

export function stampFor(receivedAt: string, site: string): string {
  return `${fmtShort(istDate(receivedAt))} ${fmtTime(receivedAt)} · ${site}`;
}

export function Clear({ children }: { children: React.ReactNode }) {
  return (
    <div className="tn-clear">
      <Icon name="check" />
      <span>{children}</span>
    </div>
  );
}

export function Flash({ tone = "ok", children }: { tone?: "ok" | "warn" | "error"; children: React.ReactNode }) {
  return (
    <div className={`flash${tone === "warn" ? " flash--warn" : tone === "error" ? " flash--error" : ""}`} role="status">
      <Icon name={tone === "ok" ? "check" : "alert"} />
      <span>{children}</span>
    </div>
  );
}
