import "server-only";
import { db, MEDIA_BUCKET, must } from "./db";
import { today } from "./dates";
import { channel, type Button } from "./messaging";
import { classify, transcribe, type ClassifyInput, type Example } from "./ai";
import { maybeAutopilot } from "./routing";
import type { Decision, Person, Project, RouteTarget, Update, UpdateKind } from "./types";

// Minimal Telegram update shapes (only what we read).
interface TgChat { id: number }
interface TgUser { first_name?: string }
interface TgPhotoSize { file_id: string; width: number; height: number; file_size?: number }
interface TgFile { file_id: string; mime_type?: string; duration?: number }
interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  date: number;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  voice?: TgFile;
  audio?: TgFile;
  video?: TgFile;
  video_note?: TgFile;
  document?: TgFile & { file_name?: string };
  location?: { latitude: number; longitude: number };
}
interface TgCallback { id: string; data?: string; from: TgUser & { id: number }; message?: TgMessage }
export interface TgUpdate { update_id: number; message?: TgMessage; edited_message?: TgMessage; callback_query?: TgCallback }

const ROLE_HELP: Record<Person["role"], string> = {
  supervisor: "Send a photo with one line, a text, or a voice note in Hindi. Tensor files it to your site and the office checks it.\nफ़ोटो के साथ एक लाइन, मैसेज या हिंदी में वॉइस नोट भेजें। Tensor इसे आपकी साइट में दर्ज करेगा।",
  doctor: "You will get a short site report with photos every evening around 9 PM, and questions that need your decision.",
  procurement: "You will get material alerts here: what to order and by when, and any broken or short deliveries.",
  head: "You will get escalations and issues that need you. Nothing else.",
  coordinator: "You will get quiet-site reminders here. Review updates in the Tensor inbox.",
};

async function reply(chatId: number, text: string, buttons?: Button[][]) {
  await channel().sendText(chatId, text, buttons);
}

async function personByChat(chatId: number): Promise<Person | null> {
  const { data } = await db().from("people").select("*").eq("telegram_chat_id", chatId).maybeSingle();
  return (data as Person | null) ?? null;
}

async function candidateProjects(person: Person): Promise<Project[]> {
  const sb = db();
  let q = sb.from("projects").select("*").in("status", ["active", "handover"]).order("start_date", { ascending: false });
  if (person.role === "supervisor") q = q.eq("supervisor_id", person.id);
  else if (person.role === "doctor") q = q.eq("doctor_id", person.id);
  const { data } = await q;
  let list = (data ?? []) as Project[];
  // A supervisor helping on another site: their remembered site counts too.
  if (person.current_project_id && !list.some((p) => p.id === person.current_project_id)) {
    const { data: cur } = await sb.from("projects").select("*").eq("id", person.current_project_id).maybeSingle();
    if (cur) list = [cur as Project, ...list];
  }
  return list;
}

function siteButtons(updateId: string, projects: Project[]): Button[][] {
  return projects.slice(0, 8).map((p) => [{ text: `${p.city} · ${p.name}`, data: `site:${updateId.slice(0, 8)}:${p.code}` }]);
}

async function linkChat(chatId: number, code: string, from?: TgUser) {
  const sb = db();
  const { data } = await sb.from("people").select("*").ilike("link_code", code.trim()).maybeSingle();
  const person = data as Person | null;
  if (!person) {
    await reply(chatId, "That code did not match anyone. Ask the office for your Tensor code and send /start CODE.\nकोड सही नहीं है। ऑफिस से अपना कोड लें।");
    return;
  }
  await sb.from("people").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId).neq("id", person.id);
  must(await sb.from("people").update({ telegram_chat_id: chatId }).eq("id", person.id), "link chat");
  const hello = `Linked as ${person.name}${from?.first_name && !person.name.includes(from.first_name) ? ` (${from.first_name})` : ""}.`;
  await reply(chatId, `${hello}\n${ROLE_HELP[person.role]}`);
}

async function storeMedia(projectCode: string, msg: TgMessage, kind: UpdateKind): Promise<{ path: string; bytes: ArrayBuffer; mime: string } | null> {
  const fileId =
    kind === "photo" ? (msg.photo ? [...msg.photo].sort((a, b) => b.width * b.height - a.width * a.height)[0].file_id : msg.document?.file_id)
    : kind === "voice" ? (msg.voice ?? msg.audio)?.file_id
    : kind === "video" ? (msg.video ?? msg.video_note)?.file_id
    : undefined;
  if (!fileId || !channel().configured()) return null;
  try {
    const f = await channel().downloadFile(fileId);
    const ext = kind === "photo" && f.ext === "bin" ? "jpg" : f.ext;
    const mime = kind === "photo" && f.mime === "application/octet-stream" ? "image/jpeg" : f.mime;
    const path = `${projectCode}/${today()}/${crypto.randomUUID()}.${ext}`;
    const up = await db().storage.from(MEDIA_BUCKET).upload(path, f.bytes, { contentType: mime, upsert: false });
    if (up.error) throw new Error(up.error.message);
    return { path, bytes: f.bytes, mime };
  } catch (e) {
    console.error("[intake] media store failed:", (e as Error).message);
    return null;
  }
}

function kindOf(msg: TgMessage): UpdateKind | null {
  if (msg.photo?.length || msg.document?.mime_type?.startsWith("image/")) return "photo";
  if (msg.voice || msg.audio) return "voice";
  if (msg.video || msg.video_note) return "video";
  if (msg.location) return "location";
  if (msg.text) return "text";
  return null;
}

async function classifyContext(projectId: string) {
  const sb = db();
  const [proj, tasks, mats, recent] = await Promise.all([
    sb.from("projects").select("name, city").eq("id", projectId).single(),
    sb.from("tasks").select("id, title, phase, trade, status").eq("project_id", projectId).order("sort"),
    sb.from("materials").select("id, item, trade, status").eq("project_id", projectId),
    sb.from("updates").select("raw_text, transcript, note, trade, zone, final_routes").eq("status", "approved")
      .eq("auto_routed", false).not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(15),
  ]);
  const examples: Example[] = ((recent.data ?? []) as Pick<Update, "raw_text" | "transcript" | "note" | "trade" | "zone" | "final_routes">[])
    .filter((u) => u.raw_text || u.transcript)
    .map((u) => ({ text: (u.transcript || u.raw_text)!, note: u.note ?? "", trade: u.trade, zone: u.zone, routes: (u.final_routes ?? []) as RouteTarget[] }));
  return {
    projectName: proj.data ? `${proj.data.name}, ${proj.data.city}` : undefined,
    tasks: (tasks.data ?? []) as ClassifyInput["tasks"],
    materials: (mats.data ?? []) as ClassifyInput["materials"],
    examples,
  };
}

/** Classify a stored update against its project and save the suggestion. */
export async function sortUpdate(update: Update, image?: { bytes: ArrayBuffer; mime: string }): Promise<Update> {
  if (!update.project_id) return update;
  const ctx = await classifyContext(update.project_id);
  const text = update.transcript && update.kind === "voice" ? update.note ?? update.transcript : update.raw_text ?? "";
  const c = await classify({ text, kind: update.kind, image, ...ctx });
  const saved = must(
    await db().from("updates").update({
      note: update.kind === "voice" && update.note ? update.note : c.note,
      trade: c.trade,
      zone: c.zone,
      is_issue: c.is_issue,
      suggested_routes: c.routes,
      suggested_action: c.action,
      ai_confidence: c.confidence,
    }).eq("id", update.id).select("*").single(),
    "save classification",
  ) as Update;
  await maybeAutopilot(saved);
  return saved;
}

async function confirm(chatId: number, u: Update, project: Project, multiSite: boolean) {
  const trade = u.trade ? ` · ${u.trade}` : "";
  const switchHint = multiSite ? "\nWrong site? Send /site" : "";
  await reply(chatId, `Logged for ${project.city}${trade}. Office will review.\n${project.city}${trade} में दर्ज हो गया। ऑफिस देखेगा।${switchHint}`);
}

async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();

  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (code) return linkChat(chatId, code, msg.from);
    const known = await personByChat(chatId);
    if (known) return reply(chatId, `You are linked as ${known.name}.\n${ROLE_HELP[known.role]}`);
    return reply(chatId, "Welcome to Tensor. Send /start followed by the code the office gave you, for example /start OM0142.\nऑफिस से मिला कोड भेजें, जैसे /start OM0142");
  }

  const person = await personByChat(chatId);
  if (!person) {
    return reply(chatId, "This phone is not linked yet. Ask the office for your code, then send /start CODE.\nयह फ़ोन जुड़ा नहीं है। ऑफिस से कोड लेकर /start CODE भेजें।");
  }

  if (text === "/help") return reply(chatId, ROLE_HELP[person.role]);

  const projects = await candidateProjects(person);

  if (text === "/site") {
    if (!projects.length) return reply(chatId, "No active site is assigned to you. Please call the office.");
    return reply(chatId, "Which site are you reporting from?\nआप किस साइट से भेज रहे हैं?",
      projects.slice(0, 8).map((p) => [{ text: `${p.city} · ${p.name}`, data: `setsite:${p.code}` }]));
  }
  if (text.startsWith("/")) return reply(chatId, ROLE_HELP[person.role]);

  const kind = kindOf(msg);
  if (!kind) return reply(chatId, "Please send a photo, a text, a voice note or your location.\nफ़ोटो, मैसेज, वॉइस नोट या लोकेशन भेजें।");

  // Telegram retries webhooks; skip a message we already stored.
  const { data: dup } = await db().from("updates").select("id").eq("person_id", person.id).eq("telegram_message_id", msg.message_id).maybeSingle();
  if (dup) return;

  // Resolve the site: the only one, the remembered one, or ask.
  let project: Project | null = null;
  if (projects.length === 1) project = projects[0];
  else if (person.current_project_id) project = projects.find((p) => p.id === person.current_project_id) ?? null;
  if (!project && projects.length === 0 && person.role !== "supervisor") {
    return reply(chatId, "Thanks. There is no active site linked to you, so this was not filed. Please call the office.");
  }

  const media = await storeMedia(project?.code ?? "unassigned", msg, kind);
  let transcript: string | null = null;
  let english: string | null = null;
  if (kind === "voice" && media) {
    const t = await transcribe({ bytes: media.bytes, mime: media.mime });
    if (t) { transcript = t.original; english = t.english; }
  }

  const raw = msg.caption ?? msg.text ?? null;
  const inserted = must(
    await db().from("updates").insert({
      project_id: project?.id ?? null,
      person_id: person.id,
      received_at: new Date(msg.date * 1000).toISOString(),
      kind,
      media_path: media?.path ?? null,
      raw_text: raw,
      transcript,
      note: english ?? (kind === "location" ? "Location shared from site" : null),
      lat: msg.location?.latitude ?? null,
      lng: msg.location?.longitude ?? null,
      telegram_message_id: msg.message_id,
      offered_project_ids: project ? null : projects.map((p) => p.id),
    }).select("*").single(),
    "store update",
  ) as Update;

  if (!project) {
    if (!projects.length) {
      return reply(chatId, "Saved. No site is assigned to you yet, so the office will file it.\nसेव हो गया। ऑफिस इसे सही साइट में डालेगा।");
    }
    return reply(chatId, "Which site is this for?\nयह किस साइट का है?", siteButtons(inserted.id, projects));
  }

  const image = kind === "photo" && media ? { bytes: media.bytes, mime: media.mime } : undefined;
  const sorted = await sortUpdate(inserted, image);
  await confirm(chatId, sorted, project, projects.length > 1);
}

async function handleCallback(cb: TgCallback) {
  const ch = channel();
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const data = cb.data ?? "";
  const person = await personByChat(chatId);
  if (!person) return ch.answerCallback(cb.id, "Not linked");
  const sb = db();

  if (data.startsWith("setsite:")) {
    const code = data.slice(8);
    const { data: p } = await sb.from("projects").select("*").eq("code", code).maybeSingle();
    if (!p) return ch.answerCallback(cb.id, "Site not found");
    await sb.from("people").update({ current_project_id: p.id }).eq("id", person.id);
    await ch.answerCallback(cb.id, `${p.city} selected`);
    if (cb.message) await ch.editButtons(chatId, cb.message.message_id, null);
    return reply(chatId, `Now reporting for ${p.city} · ${p.name}.\nअब आपकी अपडेट ${p.city} साइट में जाएंगी।`);
  }

  if (data.startsWith("site:")) {
    const [, shortId, code] = data.split(":");
    const { data: p } = await sb.from("projects").select("*").eq("code", code).maybeSingle();
    const project = p as Project | null;
    if (!project) return ch.answerCallback(cb.id, "Site not found");
    const { data: pending } = await sb.from("updates").select("*").eq("person_id", person.id).is("project_id", null)
      .order("received_at", { ascending: false }).limit(20);
    const u = ((pending ?? []) as Update[]).find((x) => x.id.startsWith(shortId));
    await sb.from("people").update({ current_project_id: project.id }).eq("id", person.id);
    if (cb.message) await ch.editButtons(chatId, cb.message.message_id, null);
    if (!u) return ch.answerCallback(cb.id, "Already filed");
    await ch.answerCallback(cb.id, `${project.city}`);
    const filed = must(await sb.from("updates").update({ project_id: project.id, offered_project_ids: null }).eq("id", u.id).select("*").single(), "file update") as Update;
    const sorted = await sortUpdate(filed);
    const all = await candidateProjects(person);
    return confirm(chatId, sorted, project, all.length > 1);
  }

  if (data.startsWith("dec:")) {
    const [, id, answer] = data.split(":");
    if (person.role !== "doctor" || !["approved", "change"].includes(answer)) return ch.answerCallback(cb.id);
    const { data: d } = await sb.from("decisions").select("*, projects!inner(doctor_id)").eq("id", id).maybeSingle();
    const dec = d as (Decision & { projects: { doctor_id: string } }) | null;
    if (!dec || dec.projects.doctor_id !== person.id) return ch.answerCallback(cb.id, "Not found");
    if (!dec.answer) {
      await sb.from("decisions").update({ answer, answered_at: new Date().toISOString() }).eq("id", id);
    }
    if (cb.message) await ch.editButtons(chatId, cb.message.message_id, null);
    await ch.answerCallback(cb.id, answer === "approved" ? "Approved" : "Change requested");
    return reply(chatId, answer === "approved" ? "Thank you. Your approval is recorded and the team will proceed." : "Noted. The coordinator will call you to discuss the change.");
  }

  return ch.answerCallback(cb.id);
}

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message ?? update.edited_message;
  if (msg && !update.edited_message) return handleMessage(msg);
}
