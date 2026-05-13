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
- Read full agenda, modify working hours, block slots, cancel/reschedule any appointment.
- Send manual WhatsApp messages to patients.
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
  patient: Patient | null,
): string {
  return `You are ${clinic}'s booking assistant on WhatsApp.
Rules:
- Pricing: full session 60 min ${sessionPrice}€, follow-up 30 min ${followupPrice}€. Payment is in person.
- The patient freely chooses 30 or 60 min. Do not contradict them; just confirm what they want.
- New patients: collect full_name + email (motivo optional). Use the update_patient tool to persist.
- For booking: use check_availability before suggesting times. Show up to 3 options.
- Always confirm a slot before calling book_appointment.
- After booking, do not promise SMS reminders — say WhatsApp reminders.
- Clinic timezone: ${tz}. Address: ${address || "(ask the owner if asked)"}.
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
  // Keep only the last MAX_TURNS messages for the LLM history (system prompt is injected each turn).
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

/**
 * Single entry point: take an inbound WhatsApp message, run DeepSeek with tools,
 * return the text reply to send back. Handles tool-call loops internally.
 */
export async function handleInbound(phone: string, body: string): Promise<HandleResult> {
  const sb = supabaseAdmin();
  const sanitized = sanitizeUserInput(body);
  await sb.from("message_log").insert({ phone, direction: "inbound", body: sanitized });

  const patient = await loadOrCreatePatient(phone, sanitized);
  const isOwner = patient.is_owner || phone === env.ownerPhone();

  const conv = await loadConversation(phone);

  // Compose system prompt: role-specific instructions + non-negotiable safety rules.
  // We put SAFETY_PROMPT last so it has the strongest recency bias.
  const baseSystem = isOwner
    ? ownerSystemPrompt(env.clinicName(), env.clinicTimezone())
    : patientSystemPrompt(
        env.clinicName(),
        env.clinicTimezone(),
        env.sessionPrice(),
        env.followupPrice(),
        env.clinicAddress(),
        patient,
      );

  const system: ChatMessage = {
    role: "system",
    content: `${baseSystem}\n\n${SAFETY_PROMPT}`,
  };

  conv.messages.push({ role: "user", content: sanitized });

  // Inject a hint with the current ISO time so the model handles relative dates.
  const timeHint: ChatMessage = {
    role: "system",
    content: `Now: ${new Date().toISOString()} (${env.clinicTimezone()})`,
  };

  const tools = toolsFor(isOwner ? "owner" : "patient");
  const toolSpecs = toDeepSeekTools(tools);

  const messages: ChatMessage[] = [system, timeHint, ...conv.messages];
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

  // Output guard: if the model leaked any forbidden substring, replace with a
  // canned refusal so we never reveal internals.
  if (looksLikePromptLeak(finalText)) {
    finalText = patient.language === "en" ? SAFE_REFUSAL.en : SAFE_REFUSAL.es;
  }

  // Persist only the user + final assistant turn (skip tool noise for readability).
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
