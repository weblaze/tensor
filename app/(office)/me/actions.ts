"use server";
import { revalidatePath } from "next/cache";
import { MANAGERS, requireRole } from "@/lib/auth";
import { db, MEDIA_BUCKET, must } from "@/lib/db";
import { today } from "@/lib/dates";
import { sortUpdate } from "@/lib/intake";
import type { Project, Update } from "@/lib/types";

export interface SendResult { ok: boolean; message: string }

const MAX_BYTES = 8 * 1024 * 1024;

/** The web version of a Telegram update: a photo and/or a line, filed and sorted the same way. */
export async function sendWebUpdateAction(_: SendResult | undefined, form: FormData): Promise<SendResult> {
  const viewer = await requireRole("supervisor", ...MANAGERS);
  const projectId = String(form.get("project_id") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, 500);
  const file = form.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (!projectId) return { ok: false, message: "Choose the site" };
  if (!text && !photo) return { ok: false, message: "Add a photo or a line about the work" };
  if (photo && (!photo.type.startsWith("image/") || photo.size > MAX_BYTES)) return { ok: false, message: "Photos only, up to 8 MB" };

  const sb = db();
  const { data: p } = await sb.from("projects").select("*").eq("id", projectId).single();
  const project = p as Project | null;
  if (!project) return { ok: false, message: "Site not found" };
  if (viewer.role === "supervisor" && project.supervisor_id !== viewer.person?.id && viewer.person?.current_project_id !== project.id) {
    return { ok: false, message: "That site is not yours" };
  }

  let mediaPath: string | null = null;
  let image: { bytes: ArrayBuffer; mime: string } | undefined;
  if (photo) {
    const bytes = await photo.arrayBuffer();
    const ext = (photo.type.split("/")[1] || "jpg").replace("jpeg", "jpg").slice(0, 5);
    mediaPath = `${project.code}/${today()}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from(MEDIA_BUCKET).upload(mediaPath, bytes, { contentType: photo.type, upsert: false });
    if (up.error) return { ok: false, message: `Photo upload failed: ${up.error.message}` };
    image = { bytes, mime: photo.type };
  }

  const inserted = must(await sb.from("updates").insert({
    project_id: project.id,
    person_id: viewer.person?.id ?? null,
    kind: photo ? "photo" : "text",
    media_path: mediaPath,
    raw_text: text || null,
  }).select("*").single(), "save update") as Update;
  const sorted = await sortUpdate(inserted, image);
  revalidatePath("/", "layout");
  return { ok: true, message: `Sent for ${project.city}${sorted.trade ? ` · ${sorted.trade}` : ""}. The office will review it.` };
}
