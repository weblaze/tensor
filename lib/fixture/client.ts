// In-memory stand-in for the subset of supabase-js that Tensor uses. Dev only (TENSOR_FIXTURE=1):
// lets the app run and be checked with no Supabase key. Not a general PostgREST emulator.
import { addDays } from "../dates";
import { seedTables, type Row, type Tables } from "./seed";

type Filter = (r: Row) => boolean;
type Result = { data: unknown; error: { message: string } | null; count?: number | null };

const g = globalThis as unknown as { __tensorFixture?: Tables };
function tables(): Tables {
  if (!g.__tensorFixture) g.__tensorFixture = seedTables();
  return g.__tensorFixture;
}

const isTs = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v);
function cmp(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (isTs(a) || isTs(b)) {
    const x = Date.parse(String(a).length === 10 ? `${a}T00:00:00Z` : String(a));
    const y = Date.parse(String(b).length === 10 ? `${b}T00:00:00Z` : String(b));
    return x - y;
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function defaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  const base: Row = { id: crypto.randomUUID() };
  if (table === "people") Object.assign(base, { link_code: Math.random().toString(16).slice(2, 8).toUpperCase(), telegram_chat_id: null, current_project_id: null, is_demo: false, created_at: now, phone: null });
  if (table === "projects") Object.assign(base, { status: "active", report_token: crypto.randomUUID().replace(/-/g, "").slice(0, 24), last_report_sent_on: null, created_at: now, order_notes: null });
  if (table === "tasks") Object.assign(base, { status: "todo", done_at: null, source: "template", sort: 0 });
  if (table === "materials") Object.assign(base, { status: "to_order", vendor: null, note: null, ordered_at: null, received_at: null, alert_sent_at: null, escalated_at: null, source: "template" });
  if (table === "updates") Object.assign(base, { received_at: now, is_issue: false, suggested_routes: [], status: "pending", auto_routed: false, final_routes: null, reviewed_at: null });
  if (table === "decisions") Object.assign(base, { asked_at: now, answer: null, answer_note: null, answered_at: null });
  if (table === "notifications") Object.assign(base, { created_at: now, channel: "telegram", status: "sent", error: null });
  return { ...base, ...row };
}

function derive(table: string, row: Row) {
  if (table === "materials" && row.need_by) row.order_by = addDays(row.need_by as string, -Number(row.lead_time_days ?? 0));
}

function views(name: string): Row[] | null {
  const t = tables();
  const proj = new Map(t.projects.map((p) => [p.id, p]));
  if (name === "learned_lead_times") {
    const groups = new Map<string, number[]>();
    for (const m of t.materials) {
      const p = proj.get(m.project_id);
      if (!p?.template_id || !m.received_at || !m.ordered_at) continue;
      const k = `${p.template_id}|${m.item}`;
      const days = Math.round((Date.parse((m.received_at as string).slice(0, 10)) - Date.parse((m.ordered_at as string).slice(0, 10))) / 86_400_000);
      groups.set(k, [...(groups.get(k) ?? []), days]);
    }
    return [...groups].map(([k, v]) => ({ template_id: k.split("|")[0], item: k.split("|")[1], lead_time_days: Math.round(v.reduce((a, b) => a + b, 0) / v.length), samples: v.length }));
  }
  if (name === "learned_tasks") {
    const groups = new Map<string, Row[]>();
    for (const x of t.tasks) {
      const p = proj.get(x.project_id);
      if (x.source !== "manual" || !p?.template_id) continue;
      const k = `${p.template_id}|${String(x.title).toLowerCase()}`;
      groups.set(k, [...(groups.get(k) ?? []), { ...x, _start: p.start_date }]);
    }
    return [...groups.values()].filter((v) => new Set(v.map((x) => x.project_id)).size >= 2).map((v) => ({
      template_id: proj.get(v[0].project_id)!.template_id, title: v[0].title, phase: v[0].phase, trade: v[0].trade, zone: v[0].zone,
      start_day: Math.round(v.reduce((a, x) => a + (Date.parse(x.planned_start as string) - Date.parse(x._start as string)) / 86_400_000, 0) / v.length),
      duration_days: 1, projects: new Set(v.map((x) => x.project_id)).size,
    }));
  }
  return null;
}

const FK: Record<string, string> = { projects: "project_id", people: "person_id" };

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: [string, boolean][] = [];
  private max: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private returning = false;
  private cols = "*";
  private countHead = false;
  constructor(private table: string, private op: "select" | "insert" | "update" | "upsert" | "delete" = "select", private payload: Row | Row[] | null = null) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.cols = cols;
    if (this.op !== "select") this.returning = true;
    if (opts?.head) this.countHead = true;
    return this;
  }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row | Row[]) { this.op = "upsert"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: null) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  not(c: string, op: string, v: unknown) { this.filters.push((r) => (op === "is" ? (r[c] ?? null) !== v : r[c] !== v)); return this; }
  contains(c: string, vs: unknown[]) { this.filters.push((r) => Array.isArray(r[c]) && vs.every((v) => (r[c] as unknown[]).includes(v))); return this; }
  // Like SQL, a comparison with NULL never matches.
  gte(c: string, v: unknown) { this.filters.push((r) => r[c] != null && cmp(r[c], v) >= 0); return this; }
  gt(c: string, v: unknown) { this.filters.push((r) => r[c] != null && cmp(r[c], v) > 0); return this; }
  lte(c: string, v: unknown) { this.filters.push((r) => r[c] != null && cmp(r[c], v) <= 0); return this; }
  lt(c: string, v: unknown) { this.filters.push((r) => r[c] != null && cmp(r[c], v) < 0); return this; }
  ilike(c: string, v: string) { const re = new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, "i"); this.filters.push((r) => re.test(String(r[c] ?? ""))); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push([c, o?.ascending !== false]); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private embed(row: Row): Row {
    const out: Row = { ...row };
    const re = /(?:(\w+):)?(\w+)(?:!(\w+))?\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.cols))) {
      const [, alias, rel, hint] = m;
      let fk = FK[rel] ?? `${rel}_id`;
      if (hint && hint.endsWith("_fkey")) fk = hint.replace(/^\w+?_/, "").replace(/_fkey$/, "");
      const target = tables()[rel]?.find((x) => x.id === row[fk]) ?? null;
      out[alias ?? rel] = target ? { ...target } : null;
    }
    return out;
  }

  private run(): Result {
    const t = tables();
    const view = views(this.table);
    if (!t[this.table] && !view) t[this.table] = [];
    const rows = view ?? t[this.table];
    const match = (r: Row) => this.filters.every((f) => f(this.embed(r)));

    let out: Row[] = [];
    if (this.op === "select") {
      out = rows.filter(match);
    } else if (this.op === "insert" || this.op === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const p of list) {
        const key = this.table === "app_settings" ? "key" : "id";
        const existing = this.op === "upsert" ? rows.find((r) => r[key] === p[key]) : undefined;
        if (existing) { Object.assign(existing, p); derive(this.table, existing); out.push(existing); continue; }
        const row = defaults(this.table, p);
        derive(this.table, row);
        rows.push(row);
        out.push(row);
      }
    } else if (this.op === "update") {
      out = rows.filter(match);
      for (const r of out) { Object.assign(r, this.payload); derive(this.table, r); }
    } else if (this.op === "delete") {
      out = rows.filter(match);
      t[this.table] = rows.filter((r) => !out.includes(r));
    }

    if (this.countHead) return { data: null, error: null, count: out.length };
    if (this.op !== "select" && !this.returning) return { data: null, error: null };

    for (const [c, asc] of [...this.orders].reverse()) out = [...out].sort((a, b) => (asc ? 1 : -1) * cmp(a[c], b[c]));
    if (this.max !== null) out = out.slice(0, this.max);
    const data = out.map((r) => this.embed(structuredClone(r)));
    if (this.mode === "single") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: `Expected 1 row, got ${data.length}` } };
    if (this.mode === "maybe") return { data: data[0] ?? null, error: null };
    return { data, error: null, count: data.length };
  }

  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(onOk, onErr);
  }
}

export function fixtureClient() {
  return {
    from: (table: string) => new Query(table),
    rpc: async (fn: string) => {
      if (fn === "reseed_demo") g.__tensorFixture = seedTables(tables().people);
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        createSignedUrls: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({ data: null, error: null }),
        upload: async (path: string) => ({ data: { path }, error: null }),
      }),
    },
  };
}
