// Offline demo data: a TypeScript port of supabase reseed_demo(), used only when TENSOR_FIXTURE=1.
// Keep in step with supabase/migrations/*_learning_seed.sql.
import { addDays, today } from "../dates";

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

const uuid = () => crypto.randomUUID();
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`).toISOString();

const TEMPLATE_TASKS: [string, string, string, "critical" | "general", number, number][] = [
  ["Site setup", "Site survey and marking", "Civil", "general", 0, 2],
  ["Site setup", "Demolition and debris removal", "Civil", "general", 1, 3],
  ["Services", "Electrical conduit rough-in", "Electrical", "general", 4, 5],
  ["Services", "MGPS copper piping", "MGPS", "critical", 6, 5],
  ["Services", "Ducting installation", "HVAC", "critical", 8, 6],
  ["Build", "Gypsum partitions and ceiling", "Civil", "general", 10, 7],
  ["Build", "Modular OT wall panels", "Panelling", "critical", 16, 6],
  ["Build", "Glass partitions, embryology lab", "Glazing", "critical", 18, 3],
  ["Finishes", "Epoxy flooring, OT and lab", "Flooring", "critical", 22, 4],
  ["Finishes", "Vinyl flooring, reception", "Flooring", "general", 24, 3],
  ["Finishes", "Sanitary fittings", "Sanitary", "general", 26, 3],
  ["Finishes", "Hermetic doors", "Doors", "critical", 28, 2],
  ["HVAC", "AHU installation", "HVAC", "critical", 24, 5],
  ["HVAC", "HEPA filters and validation", "HVAC", "critical", 34, 3],
  ["Handover", "Cryostorage room fit-out", "Panelling", "critical", 32, 4],
  ["Handover", "Deep clean and snag list", "Civil", "general", 40, 3],
  ["Handover", "Handover to client", "Coordination", "general", 44, 1],
];

const TEMPLATE_MATERIALS: [string, string, number, string, number, number][] = [
  ["Gypsum boards", "Civil", 120, "sheets", 4, 10],
  ["MGPS copper pipes", "MGPS", 1, "set", 10, 6],
  ["GI ducting", "HVAC", 1, "set", 7, 8],
  ["Modular OT wall panels", "Panelling", 1, "set", 21, 16],
  ["Glass partition panels", "Glazing", 6, "panels", 10, 18],
  ["Cleanroom LED lights", "Electrical", 24, "fixtures", 12, 20],
  ["Epoxy flooring kit", "Flooring", 1, "kit", 7, 22],
  ["Vinyl flooring", "Flooring", 80, "sqm", 7, 24],
  ["AHU unit", "HVAC", 1, "unit", 28, 24],
  ["Sanitary fittings", "Sanitary", 1, "set", 5, 26],
  ["Hermetic doors", "Doors", 3, "doors", 18, 28],
  ["HEPA filters", "HVAC", 8, "filters", 14, 34],
];

export function seedTables(keep: Row[] = []): Tables {
  const d = today();
  const now = new Date().toISOString();
  const kept = new Map(keep.map((p) => [p.name as string, p]));
  const person = (name: string, role: string, phone: string, code: string): Row => ({
    id: uuid(), name, role, phone,
    telegram_chat_id: kept.get(name)?.telegram_chat_id ?? null,
    link_code: kept.get(name)?.link_code ?? code,
    current_project_id: null, is_demo: true, created_at: now,
  });
  const people = [
    person("Abhay", "coordinator", "+91 98100 00001", "ABHAY1"),
    person("Om", "supervisor", "+91 98100 00002", "OM0142"),
    person("Rinku", "supervisor", "+91 98100 00003", "RINKU5"),
    person("Anil", "procurement", "+91 98100 00004", "ANIL01"),
    person("Prashant", "head", "+91 98100 00005", "HEAD01"),
    person("Dr. Gunjan", "doctor", "+91 98100 00006", "GUNJAN"),
    person("Dr. Mehta", "doctor", "+91 98100 00007", "MEHTA1"),
  ];
  const pid = (n: string) => people.find((p) => p.name === n)!.id as string;

  const tpl = uuid();
  const templates = [{ id: tpl, name: "IVF lab — standard fit-out", description: "Turnkey IVF clinic: OT, embryology lab, cryostorage, collection room plus reception and consult.", default_days: 45 }];
  const template_tasks = TEMPLATE_TASKS.map(([phase, title, trade, zone, start_day, duration_days], i) => ({ id: uuid(), template_id: tpl, phase, title, trade, zone, start_day, duration_days, sort: i + 1 }));
  const template_materials = TEMPLATE_MATERIALS.map(([item, trade, qty, unit, lead_time_days, need_day]) => ({ id: uuid(), template_id: tpl, item, trade, qty, unit, lead_time_days, need_day }));

  const project = (code: string, name: string, city: string, start: string, status: string, doctor: string | null, sup: string, notes: string, token?: string): Row => ({
    id: uuid(), code, name, city, template_id: tpl, doctor_id: doctor ? pid(doctor) : null, supervisor_id: pid(sup), coordinator_id: pid("Abhay"),
    start_date: start, planned_days: 45, status, order_notes: notes, report_token: token ?? uuid().replace(/-/g, "").slice(0, 24), last_report_sent_on: null, created_at: now,
  });
  const kaw = project("DM-0131", "Kawardha Fertility Centre", "Kawardha", addDays(d, -90), "closed", null, "Om", "Standard fit-out.");
  const rkl = project("DM-0136", "Rourkela IVF Centre", "Rourkela", addDays(d, -70), "closed", null, "Rinku", "Standard fit-out.");
  const gun = project("DM-0142", "Gunjan IVF", "Sonipat", addDays(d, -19), "active", "Dr. Gunjan", "Om", "Ground floor, 2,400 sq ft. Client wants white antimicrobial finish in OT. Two collection rooms.", "demo-gunjan-7f3a9c2e5b");
  const bho = project("DM-0145", "Bhopal Fertility Clinic", "Bhopal", addDays(d, -6), "active", "Dr. Mehta", "Rinku", "First floor. Existing AC to be removed. Cryostorage room needs extra power point.", "demo-bhopal-4d81e6a0c9");
  const projects = [kaw, rkl, gun, bho];
  people.find((p) => p.name === "Om")!.current_project_id = gun.id;
  people.find((p) => p.name === "Rinku")!.current_project_id = bho.id;

  const tasks: Row[] = [];
  for (const p of projects) {
    const start = p.start_date as string;
    const idx = Math.round((Date.parse(d) - Date.parse(start)) / 86_400_000);
    for (const t of template_tasks) {
      const end = t.start_day + t.duration_days - 1;
      const done = p.status === "closed" || (end < idx - 1 && t.title !== "Gypsum partitions and ceiling");
      tasks.push({
        id: uuid(), project_id: p.id, phase: t.phase, title: t.title, trade: t.trade, zone: t.zone,
        planned_start: addDays(start, t.start_day), planned_end: addDays(start, end),
        status: done ? "done" : t.start_day <= idx ? "doing" : "todo",
        done_at: done ? at(addDays(start, end), "18:00") : null, source: "template", sort: t.sort,
      });
    }
  }
  for (const p of [kaw, rkl]) {
    const start = p.start_date as string;
    tasks.push({ id: uuid(), project_id: p.id, phase: "Services", title: "MGPS pressure test", trade: "MGPS", zone: "critical", planned_start: addDays(start, 11), planned_end: addDays(start, 11), status: "done", done_at: at(addDays(start, 11), "17:00"), source: "manual", sort: 5 });
  }
  tasks.push({ id: uuid(), project_id: kaw.id, phase: "Handover", title: "Fire NOC inspection", trade: "Coordination", zone: "general", planned_start: addDays(kaw.start_date as string, 42), planned_end: addDays(kaw.start_date as string, 42), status: "done", done_at: at(addDays(kaw.start_date as string, 42), "15:00"), source: "manual", sort: 16 });

  const actual: Record<string, number> = { "Glass partition panels": 13, "AHU unit": 32, "Modular OT wall panels": 24, "Hermetic doors": 21 };
  const materials: Row[] = [];
  for (const p of projects) {
    for (const m of template_materials) {
      const need_by = addDays(p.start_date as string, m.need_day);
      const order_by = addDays(need_by, -m.lead_time_days);
      const row: Row = {
        id: uuid(), project_id: p.id, item: m.item, trade: m.trade, qty: m.qty, unit: m.unit, lead_time_days: m.lead_time_days,
        need_by, order_by, status: "to_order", vendor: null, note: null, ordered_at: null, received_at: null, alert_sent_at: null, escalated_at: null, source: "template",
      };
      if (p.status === "closed") {
        const lead = actual[m.item] ?? m.lead_time_days;
        Object.assign(row, { status: "received", vendor: "Past vendor", ordered_at: at(addDays(need_by, -lead), "11:00"), received_at: at(need_by, "15:00") });
      } else if (p === gun) {
        if (["Gypsum boards", "MGPS copper pipes", "GI ducting", "Modular OT wall panels"].includes(m.item)) {
          Object.assign(row, { status: "received", ordered_at: at(addDays(order_by, -1), "11:00"), received_at: at(addDays(need_by, -1), "14:00") });
        } else if (["Glass partition panels", "AHU unit", "Epoxy flooring kit", "Cleanroom LED lights", "Vinyl flooring"].includes(m.item)) {
          Object.assign(row, { status: "ordered", ordered_at: at(order_by, "12:00"), vendor: m.item === "Glass partition panels" ? "Saint-Gobain dealer, Delhi" : m.item === "AHU unit" ? "Zeco Aircon" : null });
        } else if (m.item === "Hermetic doors") {
          Object.assign(row, { alert_sent_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), escalated_at: new Date(Date.now() - 86_400_000).toISOString() });
        }
      } else if (order_by <= addDays(d, 2)) {
        Object.assign(row, { status: "ordered", ordered_at: at(order_by < d ? order_by : d, "12:00") });
      }
      materials.push(row);
    }
  }
  const glass = materials.find((m) => m.project_id === gun.id && m.item === "Glass partition panels")!;

  const updates: Row[] = [];
  const upd = (p: Row, who: string, daysAgo: number, hhmm: string, raw: string, note: string, trade: string, zone: string, issue: boolean, suggested: string[], final: string[] | null, conf: number, extra: Row = {}) => {
    const date = addDays(d, -daysAgo);
    updates.push({
      id: uuid(), project_id: p.id, person_id: pid(who), received_at: at(date, hhmm), kind: "photo", media_path: null, raw_text: raw, transcript: null, note, trade, zone,
      is_issue: issue, suggested_routes: suggested, suggested_action: null, ai_confidence: conf, final_routes: final, status: final ? "approved" : "pending",
      reviewed_at: final ? new Date(Date.parse(at(date, hhmm)) + 25 * 60_000).toISOString() : null, auto_routed: false, lat: null, lng: null, telegram_message_id: null, offered_project_ids: null, ...extra,
    });
  };
  const hist: [Row, string, number, string, string, string, string, boolean, string[], string[], number][] = [
    [gun, "Om", 17, "10:05", "Site survey done, marking complete for OT and lab", "Civil", "general", false, ["doctor"], ["doctor"], 0.92],
    [gun, "Om", 15, "16:40", "Demolition finished, debris cleared", "Civil", "general", false, ["doctor"], ["doctor"], 0.9],
    [gun, "Om", 13, "12:15", "Electrical conduits laid in reception and consult", "Electrical", "general", false, ["doctor"], ["doctor"], 0.88],
    [gun, "Om", 11, "15:30", "MGPS copper piping started in OT", "MGPS", "critical", false, ["doctor"], ["doctor"], 0.91],
    [gun, "Om", 9, "11:50", "MGPS piping complete, pressure test passed", "MGPS", "critical", false, ["doctor", "head"], ["doctor", "head"], 0.86],
    [gun, "Om", 7, "17:10", "Ducting installed above OT ceiling", "HVAC", "critical", false, ["doctor"], ["doctor"], 0.9],
    [gun, "Om", 5, "13:20", "Gypsum boards short by 10 sheets", "Civil", "general", true, ["procurement"], ["procurement", "head"], 0.74],
    [gun, "Om", 3, "10:45", "OT wall panels delivered to site", "Panelling", "critical", false, ["doctor"], ["doctor"], 0.89],
    [gun, "Om", 2, "16:05", "OT wall panel fixing started", "Panelling", "critical", false, ["doctor"], ["doctor"], 0.9],
    [gun, "Om", 1, "18:20", "Embryology lab glass frame marked", "Glazing", "critical", false, ["doctor"], [], 0.62],
    [bho, "Rinku", 5, "11:00", "Site survey and marking done", "Civil", "general", false, ["doctor"], ["doctor"], 0.92],
    [bho, "Rinku", 4, "15:45", "Old AC units removed", "Civil", "general", false, ["doctor"], ["doctor"], 0.87],
    [bho, "Rinku", 3, "12:30", "Demolition 70 percent done", "Civil", "general", false, ["doctor"], ["doctor"], 0.9],
    [bho, "Rinku", 2, "17:30", "Debris removal complete, conduit work from tomorrow", "Civil", "general", false, ["doctor"], ["doctor"], 0.91],
  ];
  for (const [p, who, ago, hhmm, note, trade, zone, issue, s, f, c] of hist) upd(p, who, ago, hhmm, note, note, trade, zone, issue, s, f, c);
  upd(gun, "Om", 0, "11:20", "epoxy base coat ho gaya OT mein, kal second coat", "Epoxy base coat done in OT, second coat tomorrow", "Flooring", "critical", false, ["doctor"], ["doctor"], 0.93);
  upd(gun, "Om", 0, "13:05", "AHU base frame installed", "AHU base frame installed", "HVAC", "critical", false, ["doctor", "head"], ["doctor", "head"], 0.9);
  upd(gun, "Om", 0, "15:12", "glass panels received but 2 broken, please reorder", "Glass panels received, 2 broken, please reorder", "Glazing", "critical", true, ["procurement", "head"], null, 0.86,
    { suggested_action: { type: "material_status", material_id: glass.id, status: "issue", note: "2 broken, reorder" } });
  upd(gun, "Om", 0, "16:48", "phase 1 complete", "Phase 1 complete", "Coordination", "general", false, ["doctor", "head"], null, 0.72,
    { kind: "text", suggested_action: { type: "phase_done", phase: "Services" } });
  upd(gun, "Om", 0, "17:31", "aaj labour kam hai, 3 aadmi nahi aaye", "Labour short today, 3 men absent", "Civil", "general", true, ["head"], null, 0.9,
    { kind: "voice", transcript: "aaj labour kam hai, 3 aadmi nahi aaye" });
  // Same as migration reseed_times: pull today's future-dated updates back to just before now.
  const nowMs = Date.now();
  const dayStart = Date.parse(`${d}T00:05:00+05:30`);
  updates.filter((u) => Date.parse(u.received_at as string) > nowMs)
    .sort((a, b) => Date.parse(b.received_at as string) - Date.parse(a.received_at as string))
    .forEach((u, i) => {
      u.received_at = new Date(Math.max(dayStart + (9 - i) * 60_000, nowMs - (20 + 35 * i) * 60_000)).toISOString();
    });
  for (const u of updates) {
    if (u.reviewed_at && Date.parse(u.reviewed_at as string) > nowMs) {
      u.reviewed_at = new Date(Math.min(Date.parse(u.received_at as string) + 20 * 60_000, nowMs)).toISOString();
    }
  }

  return {
    people, templates, template_tasks, template_materials, projects, tasks, materials, updates,
    decisions: [{ id: uuid(), project_id: gun.id, question: "Approve OT wall finish: white antimicrobial HPL", asked_at: at(addDays(d, -2), "12:00"), answer: null, answer_note: null, answered_at: null }],
    app_settings: [{ key: "autopilot", value: { enabled: false, min_confidence: 0.9 } }],
    notifications: [],
  };
}
