// Starting points the setup wizard can offer. Day numbers count from 1 (day 1 = project start).

export const IVF_EXAMPLE = {
  name: "IVF clinic — standard fit-out",
  description: "Turnkey IVF clinic: OT, embryology lab, cryostorage, collection room plus reception and consult.",
  days: 45,
  zones: { critical: "Critical", general: "General" },
  tasks: [
    { phase: "Site setup", title: "Site survey and marking", trade: "Civil", zone: "general", start_day: 1, duration_days: 2 },
    { phase: "Site setup", title: "Demolition and debris removal", trade: "Civil", zone: "general", start_day: 2, duration_days: 3 },
    { phase: "Services", title: "Electrical conduit rough-in", trade: "Electrical", zone: "general", start_day: 5, duration_days: 5 },
    { phase: "Services", title: "MGPS copper piping", trade: "MGPS", zone: "critical", start_day: 7, duration_days: 5 },
    { phase: "Services", title: "Ducting installation", trade: "HVAC", zone: "critical", start_day: 9, duration_days: 6 },
    { phase: "Build", title: "Gypsum partitions and ceiling", trade: "Civil", zone: "general", start_day: 11, duration_days: 7 },
    { phase: "Build", title: "Modular OT wall panels", trade: "Panelling", zone: "critical", start_day: 17, duration_days: 6 },
    { phase: "Build", title: "Glass partitions, embryology lab", trade: "Glazing", zone: "critical", start_day: 19, duration_days: 3 },
    { phase: "Finishes", title: "Epoxy flooring, OT and lab", trade: "Flooring", zone: "critical", start_day: 23, duration_days: 4 },
    { phase: "Finishes", title: "Vinyl flooring, reception", trade: "Flooring", zone: "general", start_day: 25, duration_days: 3 },
    { phase: "Finishes", title: "Sanitary fittings", trade: "Sanitary", zone: "general", start_day: 27, duration_days: 3 },
    { phase: "Finishes", title: "Hermetic doors", trade: "Doors", zone: "critical", start_day: 29, duration_days: 2 },
    { phase: "HVAC", title: "AHU installation", trade: "HVAC", zone: "critical", start_day: 25, duration_days: 5 },
    { phase: "HVAC", title: "HEPA filters and validation", trade: "HVAC", zone: "critical", start_day: 35, duration_days: 3 },
    { phase: "Handover", title: "Cryostorage room fit-out", trade: "Panelling", zone: "critical", start_day: 33, duration_days: 4 },
    { phase: "Handover", title: "Deep clean and snag list", trade: "Civil", zone: "general", start_day: 41, duration_days: 3 },
    { phase: "Handover", title: "Handover to client", trade: "Coordination", zone: "general", start_day: 45, duration_days: 1 },
  ] as { phase: string; title: string; trade: string; zone: "critical" | "general"; start_day: number; duration_days: number }[],
  materials: [
    { item: "Gypsum boards", trade: "Civil", qty: 120, unit: "sheets", lead_time_days: 4, need_day: 11 },
    { item: "MGPS copper pipes", trade: "MGPS", qty: 1, unit: "set", lead_time_days: 10, need_day: 7 },
    { item: "GI ducting", trade: "HVAC", qty: 1, unit: "set", lead_time_days: 7, need_day: 9 },
    { item: "Modular OT wall panels", trade: "Panelling", qty: 1, unit: "set", lead_time_days: 21, need_day: 17 },
    { item: "Glass partition panels", trade: "Glazing", qty: 6, unit: "panels", lead_time_days: 10, need_day: 19 },
    { item: "Cleanroom LED lights", trade: "Electrical", qty: 24, unit: "fixtures", lead_time_days: 12, need_day: 21 },
    { item: "Epoxy flooring kit", trade: "Flooring", qty: 1, unit: "kit", lead_time_days: 7, need_day: 23 },
    { item: "Vinyl flooring", trade: "Flooring", qty: 80, unit: "sqm", lead_time_days: 7, need_day: 25 },
    { item: "AHU unit", trade: "HVAC", qty: 1, unit: "unit", lead_time_days: 28, need_day: 25 },
    { item: "Sanitary fittings", trade: "Sanitary", qty: 1, unit: "set", lead_time_days: 5, need_day: 27 },
    { item: "Hermetic doors", trade: "Doors", qty: 3, unit: "doors", lead_time_days: 18, need_day: 29 },
    { item: "HEPA filters", trade: "HVAC", qty: 8, unit: "filters", lead_time_days: 14, need_day: 35 },
  ],
  fields: [
    { label: "Client contact person", kind: "text" as const, required: true, help: "Who decides on the client side" },
    { label: "Client contact phone", kind: "phone" as const, required: true },
    { label: "Site address", kind: "text" as const, required: false },
  ],
};

export const PHASE_SUGGESTIONS = ["Site setup", "Services", "Build", "Finishes", "HVAC", "Handover", "Design", "Approvals", "Civil work", "Interiors", "Testing", "Validation"];
export const TRADE_SUGGESTIONS = ["Civil", "Electrical", "MGPS", "HVAC", "Panelling", "Glazing", "Flooring", "Sanitary", "Doors", "Plumbing", "Carpentry", "Painting", "Fire safety", "Coordination"];
export const FIELD_SUGGESTIONS = ["Client contact person", "Client contact phone", "Architect", "Hospital administrator", "Site address", "Purchase order number", "Billing contact"];
