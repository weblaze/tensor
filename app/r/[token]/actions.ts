"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { notifyRole } from "@/lib/notify";

// Doctor answers a decision from the public report. The report token proves which project they can answer for.
export async function answerDecisionAction(answer: "approved" | "change", form: FormData) {
  const token = String(form.get("token") ?? "");
  const id = String(form.get("id") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const date = String(form.get("date") ?? "");
  if (!["approved", "change"].includes(answer)) return;
  const sb = db();
  const { data: p } = await sb.from("projects").select("id, code, name, city").eq("report_token", token).maybeSingle();
  if (!p) return;
  const { data: d } = await sb.from("decisions").select("*").eq("id", id).eq("project_id", p.id).maybeSingle();
  if (!d || d.answer) redirect(`/r/${token}${date ? `?date=${date}` : ""}`);
  await sb.from("decisions").update({ answer, answer_note: note, answered_at: new Date().toISOString() }).eq("id", id);
  await notifyRole("coordinator", "decision_answer", `${p.code} ${p.name}, ${p.city}\nDoctor ${answer === "approved" ? "approved" : "requested a change"}: ${d.question}${note ? `\n“${note}”` : ""}`, { projectId: p.id });
  if (answer === "change") {
    await notifyRole("head", "decision_answer", `${p.code} ${p.name}: the doctor requested a change on “${d.question}”.${note ? `\n“${note}”` : ""}`, { projectId: p.id });
  }
  revalidatePath(`/r/${token}`);
  redirect(`/r/${token}?${date ? `date=${date}&` : ""}answered=${answer}`);
}
