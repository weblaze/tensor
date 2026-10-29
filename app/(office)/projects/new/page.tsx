import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { listTemplates } from "@/lib/planner";
import type { Person } from "@/lib/types";
import { aiConfigured } from "@/lib/ai";
import { Planner } from "./Planner";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const [templates, peopleRes] = await Promise.all([listTemplates(), db().from("people").select("*").order("name")]);
  const people = (peopleRes.data ?? []) as Person[];
  const pick = (role: Person["role"]) => people.filter((p) => p.role === role).map((p) => ({ id: p.id, name: p.name }));
  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">Plan a project</h1>
          <p className="tn-muted">Pick a template. Tensor lays out tasks and order-by dates from install dates and real lead times.</p>
        </div>
      </div>
      <Planner
        templates={templates.map((t) => ({ id: t.id, name: t.name, days: t.default_days, description: t.description }))}
        doctors={pick("doctor")}
        supervisors={pick("supervisor")}
        coordinators={pick("coordinator")}
        today={today()}
        defaultStart={addDays(today(), 3)}
        aiLabel={aiConfigured() ? "Gemini" : "keyword rules (no AI key yet)"}
      />
    </main>
  );
}
