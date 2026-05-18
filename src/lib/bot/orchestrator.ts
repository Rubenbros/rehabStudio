import { chat, ChatMessage, ToolCall } from "./deepseek";
import { runTool, toDeepSeekTools, toolsFor } from "./tools";
import { supabaseAdmin } from "./supabase";
import { env } from "./env";
import { detectLang, Lang, T } from "./i18n";
import {
  SAFETY_PROMPT,
  SAFE_REFUSAL,
  looksLikePromptLeak,
  sanitizeUserInput,
  stripInternalIds,
} from "./security";

const MAX_TURNS = 20;
const MAX_TOOL_LOOPS = 4;

interface Patient {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  language: Lang;
  is_owner: boolean;
}

interface Conversation {
  phone: string;
  state: string;
  context: Record<string, unknown>;
  messages: ChatMessage[];
}

function ownerSystemPrompt(clinic: string, tz: string): string {
  return `You are the admin assistant for ${clinic}'s WhatsApp.
You are talking to the OWNER (the physiotherapist), so you have full privileges:
- Read full agenda, block slots, cancel/reschedule any appointment.
- Send manual WhatsApp messages to patients.
- Approve or reject pending extended-hours requests using approve_appointment / reject_appointment.
  Match the patient by name and/or datetime when the owner refers to them in natural language
  (e.g. "acepta la de María del sábado"). If two pending requests match the same description,
  ask the owner to clarify before acting. The current pending list is provided on every turn.
- Answer patient questions: when there are open patient questions (injected on each turn), the
  owner's natural-language reply is intended for the patient. Call answer_question(question_id, answer)
  with the right question_id and the owner's wording. If the owner's message clearly does NOT match
  any open question (e.g. they are giving you an unrelated admin instruction), just handle the admin
  task and leave the questions alone.
- Modify working hours and the core/extended split: each day window has a mode ("core" = auto-confirmed,
  "extended" = needs owner approval). Workflow: call get_working_hours, modify only the relevant
  day(s) (keeping the same structure), then call set_working_hours with the FULL updated config.
  Before saving, summarise the change in plain language and ask the owner to confirm.
Always confirm destructive actions briefly before doing them. Answer in the owner's language.
Clinic timezone: ${tz}. Today's ISO date will be provided in the user turn when relevant.
Be concise. Use bullet lists for agenda listings.`;
}

function patientSystemPrompt(
  clinic: string,
  tz: string,
  sessionPrice: number,
  followupPrice: number,
  address: string,
  ownerPhone: string,
  patient: Patient | null,
): string {
  return `You are ${clinic}'s booking assistant on WhatsApp.
Rules:
- Pricing: full session 60 min ${sessionPrice}€, follow-up 30 min ${followupPrice}€. Payment is in person.
- The patient freely chooses 30 or 60 min. Do not contradict them; just confirm what they want.
- New patients: collect full_name + email (motivo optional). Use the update_patient tool to persist.
- For booking: ALWAYS call check_availability first. Each slot returns its "mode": "core" or "extended".
  - "core" = standard hours; the booking is confirmed instantly.
  - "extended" = early morning, evening, or Saturdays; requires the owner's approval.
  - When proposing an extended slot, tell the patient it's outside the normal schedule and you have to ask the physio first.
- All slots are ON THE HOUR (08:00, 09:00, 10:00 ... NEVER xx:15 or xx:30). If the patient asks
  for a non-hour time (e.g. "a las 17:15"), reply offering the nearest hour options ("¿prefieres
  a las 17:00 o a las 18:00?") and proceed from there. Both 30 min follow-ups and 60 min sessions
  start on the hour.
- Always confirm the chosen slot with the patient before calling book_appointment.
- React to the response of book_appointment:
  - status="confirmed" → tell the patient it's booked and that you'll send a reminder the day before in the evening.
  - status="pending_approval" → tell the patient the request was sent to the physio and you'll confirm by WhatsApp shortly (auto-rejected after 2h with no answer).
- Never promise SMS — only WhatsApp.
- PHYSIOTHERAPY / MEDICAL QUESTIONS: never give clinical advice. If the patient asks about pain,
  exercises, injuries, symptoms, treatments, diagnosis, recovery, contraindications, second opinions
  or any medical topic, call ask_owner_question with their question. Tell the patient afterwards that
  you've forwarded it to the physio and you'll reply as soon as he answers. As a fallback for urgent
  cases tell them they can also call ${ownerPhone}.
- Clinic timezone: ${tz}. Address: ${address || "(ask the owner if asked)"}.
- Clinic contact phone for medical questions: ${ownerPhone}.
- Reply in the patient's language (Spanish or English). Keep messages short and warm.

Patient context: ${
    patient
      ? JSON.stringify({
          name: patient.full_name,
          email: patient.email,
          lang: patient.language,
        })
      : "unknown (new patient)"
  }`;
}

interface PendingApprovalSummary {
  appointment_id: string;
  patient_name: string;
  patient_phone: string;
  starts_at: string;
  duration_min: number;
  created_at: string;
}

async function loadPendingApprovals(): Promise<PendingApprovalSummary[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("appointments")
    .select("id,patient_name,patient_phone,starts_at,duration_min,created_at")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    appointment_id: r.id,
    patient_name: r.patient_name ?? "(sin nombre)",
    patient_phone: r.patient_phone,
    starts_at: r.starts_at,
    duration_min: r.duration_min,
    created_at: r.created_at,
  }));
}

interface OpenQuestionSummary {
  question_id: string;
  patient_name: string;
  patient_phone: string;
  question: string;
  asked_at: string;
}

async function loadOpenQuestions(): Promise<OpenQuestionSummary[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("pending_questions")
    .select("id,patient_name,patient_phone,question,asked_at")
    .eq("status", "pending")
    .order("asked_at", { ascending: true });
  return (data ?? []).map((r) => ({
    question_id: r.id,
    patient_name: r.patient_name ?? "(sin nombre)",
    patient_phone: r.patient_phone,
    question: r.question,
    asked_at: r.asked_at,
  }));
}

export async function loadConversation(phone: string): Promise<Conversation> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("conversations").select("*").eq("phone", phone).maybeSingle();
  if (data) {
    return {
      phone,
      state: data.state,
      context: data.context ?? {},
      messages: (data.messages ?? []) as ChatMessage[],
    };
  }
  return { phone, state: "idle", context: {}, messages: [] };
}

export async function saveConversation(c: Conversation): Promise<void> {
  const sb = supabaseAdmin();
  const trimmed = c.messages.slice(-MAX_TURNS);
  await sb
    .from("conversations")
    .upsert(
      {
        phone: c.phone,
        state: c.state,
        context: c.context,
        messages: trimmed,
        last_active: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );
}

async function loadOrCreatePatient(phone: string, firstMessage: string): Promise<Patient> {
  const sb = supabaseAdmin();
  const { data: existing } = await sb.from("patients").select("*").eq("phone", phone).maybeSingle();
  if (existing) return existing as Patient;
  const lang = detectLang(firstMessage);
  const isOwner = phone === env.ownerPhone();
  const { data: created, error } = await sb
    .from("patients")
    .insert({ phone, language: lang, is_owner: isOwner })
    .select()
    .single();
  if (error) throw error;
  return created as Patient;
}

export interface HandleResult {
  reply: string;
  isOwner: boolean;
}

export async function handleInbound(phone: string, body: string): Promise<HandleResult> {
  const sb = supabaseAdmin();
  const sanitized = sanitizeUserInput(body);
  await sb.from("message_log").insert({ phone, direction: "inbound", body: sanitized });

  const patient = await loadOrCreatePatient(phone, sanitized);
  const isOwner = patient.is_owner || phone === env.ownerPhone();

  const conv = await loadConversation(phone);

  const baseSystem = isOwner
    ? ownerSystemPrompt(env.clinicName(), env.clinicTimezone())
    : patientSystemPrompt(
        env.clinicName(),
        env.clinicTimezone(),
        env.sessionPrice(),
        env.followupPrice(),
        env.clinicAddress(),
        env.ownerPhone(),
        patient,
      );

  const system: ChatMessage = {
    role: "system",
    content: `${baseSystem}\n\n${SAFETY_PROMPT}`,
  };

  conv.messages.push({ role: "user", content: sanitized });

  const timeHint: ChatMessage = {
    role: "system",
    content: `Now: ${new Date().toISOString()} (${env.clinicTimezone()})`,
  };

  const extraSystem: ChatMessage[] = [];
  if (isOwner) {
    const [pending, openQs] = await Promise.all([
      loadPendingApprovals(),
      loadOpenQuestions(),
    ]);
    if (pending.length > 0) {
      extraSystem.push({
        role: "system",
        content:
          `Pending extended-hours approval requests (use approve_appointment / reject_appointment with the appointment_id):\n` +
          JSON.stringify(pending, null, 2),
      });
    }
    if (openQs.length > 0) {
      extraSystem.push({
        role: "system",
        content:
          `Open patient questions waiting for an answer. If the owner's reply addresses any of these, call answer_question(question_id, answer) with the owner's wording — do not paraphrase. Match by name or topic; if ambiguous, ask the owner which one they meant.\n` +
          JSON.stringify(openQs, null, 2),
      });
    }
  }

  const tools = toolsFor(isOwner ? "owner" : "patient");
  const toolSpecs = toDeepSeekTools(tools);

  const messages: ChatMessage[] = [system, timeHint, ...extraSystem, ...conv.messages];
  let finalText: string | null = null;

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const { message } = await chat(messages, toolSpecs);
    messages.push(message);

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const call of message.tool_calls) {
        const result = await safeRunTool(call, phone, isOwner);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    finalText = (message.content ?? "").trim();
    break;
  }

  if (!finalText) finalText = patient.language === "en" ? T.notUnderstood.en : T.notUnderstood.es;

  if (looksLikePromptLeak(finalText)) {
    finalText = patient.language === "en" ? SAFE_REFUSAL.en : SAFE_REFUSAL.es;
  }

  // Last-mile: scrub any internal IDs the LLM may have echoed.
  finalText = stripInternalIds(finalText);

  const assistantTurn: ChatMessage = { role: "assistant", content: finalText };
  conv.messages = [...conv.messages, assistantTurn].slice(-MAX_TURNS);
  await saveConversation(conv);

  return { reply: finalText, isOwner };
}

async function safeRunTool(call: ToolCall, phone: string, isOwner: boolean) {
  try {
    const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    const out = await runTool(call.function.name, args, { callerPhone: phone, isOwner });
    return { ok: true, data: out };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
