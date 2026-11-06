import Link from "next/link";
import { MANAGERS, requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { listTemplates } from "@/lib/planner";
import { configOf } from "@/lib/templateConfig";
import type { Person } from "@/lib/types";
import { aiConfigured } from "@/lib/ai";
import { Icon } from "@/components/Icon";
import { Planner } from "./Planner";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requirePage(...MANAGERS);
  const [templates, peopleRes] = await Promise.all([listTemplates(), db().from("people").select("id, name, role").order("name")]);
  const people = (peopleRes.data ?? []) as Pick<Person, "id" | "name" | "role">[];
  const pick = (role: Person["role"]) => people.filter((p) => p.role === role).map((p) => ({ id: p.id, name: p.name }));

  // First time: there is nothing to plan from yet, so set up how this office works first.
  if (templates.length === 0) {
    return (
      <main className="page page--narrow">
        <div className="card stack-4">
          <span className="tn-stamp">First time</span>
          <h1 className="tn-title">Set up how your office works</h1>
          <p>
            Projects are planned from a template: your phases, the words you use for a task&apos;s status, your trades, the
            details every project must record, and the tasks and materials you usually need. The setup takes about ten minutes
            and explains each step.
          </p>
          <div className="tn-row">
            <Link href="/settings/templates/new?tutorial=1" className="tn-btn tn-btn--primary"><Icon name="bolt" />Start setup</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">Plan a project</h1>
          <p className="tn-muted">Pick a template. Tensor lays out tasks and order-by dates from install dates and real lead times.</p>
        </div>
      </div>
      <Planner
        templates={templates.map((t) => ({ id: t.id, name: t.name, days: t.default_days, description: t.description, fields: configOf(t).project_fields }))}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
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
