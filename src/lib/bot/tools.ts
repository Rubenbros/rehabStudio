import { z } from "zod";
import { addDays } from "date-fns";
import { supabaseAdmin } from "./supabase";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listEvents,
  updateCalendarEvent,
} from "./calendar";
import {
  findAvailableSlots,
  getSchedule,
  setSchedule,
  formatWhen,
  modeForStartTime,
  ScheduleConfig,
} from "./schedule";
import { sendWhatsApp } from "./twilio";
import { env } from "./env";
import type { ToolSpec } from "./deepseek";

export type Audience = "patient" | "owner" | "both";

export interface Tool<Args, Result> {
  name: string;
  description: string;
  audience: Audience;
  schema: Record<string, unknown>;
  args: z.ZodType<Args>;
  run: (args: Args, ctx: ToolContext) => Promise<Result>;
}

export interface ToolContext {
  callerPhone: string | null;
  isOwner: boolean;
}

const checkAvailability: Tool<
  { from?: string; days?: number; duration_min: 30 | 60 },
  { slots: { starts_at: string; mode: "core" | "extended" }[] }
> = {
  name: "check_availability",
  description:
    "Returns available appointment slots (ISO 8601) tagged with their mode: 'core' (auto-confirmed) or 'extended' (requires owner approval). Use this BEFORE proposing times so you can warn the patient if a slot is outside normal hours.",
  audience: "both",
  schema: {
    type: "object",
    properties: {
      from: { type: "string", description: "ISO datetime to start searching from. Defaults to now." },
      days: { type: "integer", description: "How many days ahead to search. Defaults to 14.", default: 14 },
      duration_min: { type: "integer", enum: [30, 60], description: "30 for follow-up, 60 for full session." },
    },
    required: ["duration_min"],
  },
  args: z.object({
    from: z.string().optional(),
    days: z.number().int().min(1).max(60).optional(),
    duration_min: z.union([z.literal(30), z.literal(60)]),
  }),
  async run({ from, days = 14, duration_min }) {
    const start = from ? new Date(from) : new Date();
    const end = addDays(start, days);
    const slots = await findAvailableSlots(start, end, duration_min);
    return {
      slots: slots.slice(0, 12).map((s) => ({ starts_at: s.time.toISOString(), mode: s.mode })),
    };
  },
};

const bookAppointment: Tool<
  {
    starts_at: string;
    duration_min: 30 | 60;
    patient_phone?: string;
    patient_name?: string;
    patient_email?: string;
    notes?: string;
  },
  {
    status: "confirmed" | "pending_approval";
    appointment_id: string;
    google_event_id?: string;
    when: string;
    price_eur: number;
  }
> = {
  name: "book_appointment",
  description:
    "Books an appointment. If the slot is in core hours, it is confirmed immediately and a Google Calendar event is created. If it falls in extended hours (early morning / evening / Saturdays), it is stored as pending_approval and the owner is notified via WhatsApp — the Calendar event is only created when the owner approves.",
  audience: "both",
  schema: {
    type: "object",
    properties: {
      starts_at: { type: "string" },
      duration_min: { type: "integer", enum: [30, 60] },
      patient_phone: { type: "string" },
      patient_name: { type: "string" },
      patient_email: { type: "string" },
      notes: { type: "string" },
    },
    required: ["starts_at", "duration_min"],
  },
  args: z.object({
    starts_at: z.string(),
    duration_min: z.union([z.literal(30), z.literal(60)]),
    patient_phone: z.string().optional(),
    patient_name: z.string().optional(),
    patient_email: z.string().optional(),
    notes: z.string().optional(),
  }),
  async run(input, ctx) {
    const phone = input.patient_phone ?? ctx.callerPhone;
    if (!phone) throw new Error("patient_phone is required when no caller phone is in context");

    const sb = supabaseAdmin();
    const { data: patient } = await sb.from("patients").select("*").eq("phone", phone).maybeSingle();

    const name = input.patient_name ?? patient?.full_name ?? "Paciente";
    const email = input.patient_email ?? patient?.email ?? undefined;

    const startsAt = new Date(input.starts_at);
    const endsAt = new Date(startsAt.getTime() + input.duration_min * 60_000);
    const price = input.duration_min === 60 ? env.sessionPrice() : env.followupPrice();
    const mode = await modeForStartTime(startsAt);

    if (!mode) throw new Error("Requested time is outside any working window");

    if (mode === "extended" && !ctx.isOwner) {
      const { data: appt, error } = await sb
        .from("appointments")
        .insert({
          patient_id: patient?.id ?? null,
          patient_phone: phone,
          patient_name: name,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_min: input.duration_min,
          price_eur: price,
          kind: input.duration_min === 30 ? "followup" : "session",
          status: "pending_approval",
          notes: input.notes,
        })
        .select()
        .single();
      if (error) throw error;

      await notifyOwnerOfPending({
        appointmentId: appt.id,
        patientName: name,
        patientPhone: phone,
        startsAt,
        durationMin: input.duration_min,
      });

      return { status: "pending_approval", appointment_id: appt.id, when: formatWhen(startsAt), price_eur: price };
    }

    const event = await createCalendarEvent({
      patientName: name,
      patientEmail: email,
      patientPhone: phone,
      startsAt,
      durationMin: input.duration_min,
      notes: input.notes,
    });

    const { data: appt, error } = await sb
      .from("appointments")
      .insert({
        patient_id: patient?.id ?? null,
        patient_phone: phone,
        patient_name: name,
        google_event_id: event.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_min: input.duration_min,
        price_eur: price,
        kind: input.duration_min === 30 ? "followup" : "session",
        status: "confirmed",
        notes: input.notes,
        confirmation_sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return {
      status: "confirmed",
      appointment_id: appt.id,
      google_event_id: event.id!,
      when: formatWhen(startsAt),
      price_eur: price,
    };
  },
};

async function notifyOwnerOfPending(p: {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  startsAt: Date;
  durationMin: number;
}) {
  const when = formatWhen(p.startsAt);
  const body =
    `📩 Solicitud fuera de horario habitual.\n` +
    `Paciente: ${p.patientName}\n` +
    `Teléfono: ${p.patientPhone}\n` +
    `Cuándo: ${when}\n` +
    `Duración: ${p.durationMin} min\n\n` +
    `Responde diciendo "acepta" o "rechaza" + el nombre del paciente. ` +
    `Si no respondes en 2h se rechaza automáticamente.`;
  try {
    await sendWhatsApp(env.ownerPhone(), body, { kind: "pending_approval_request", appointment_id: p.appointmentId });
  } catch (err) {
    console.error("[notifyOwnerOfPending] failed", err);
  }
}

const listAppointments: Tool<
  { phone?: string; from?: string; to?: string; include_pending?: boolean },
  { appointments: AppointmentRow[] }
> = {
  name: "list_appointments",
  description:
    "List appointments. Patient context returns only their own; owner can filter by phone or date range. Set include_pending=true to also return pending_approval rows.",
  audience: "both",
  schema: {
    type: "object",
    properties: {
      phone: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      include_pending: { type: "boolean" },
    },
  },
  args: z.object({
    phone: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    include_pending: z.boolean().optional(),
  }),
  async run({ phone, from, to, include_pending }, ctx) {
    const sb = supabaseAdmin();
    const fromD = from ? new Date(from) : new Date();
    const toD = to ? new Date(to) : addDays(fromD, 30);
    let q = sb
      .from("appointments")
      .select("*")
      .gte("starts_at", fromD.toISOString())
      .lte("starts_at", toD.toISOString())
      .neq("status", "cancelled")
      .order("starts_at");
    if (!include_pending) q = q.neq("status", "pending_approval");
    if (!ctx.isOwner && ctx.callerPhone) q = q.eq("patient_phone", ctx.callerPhone);
    else if (phone) q = q.eq("patient_phone", phone);
    const { data, error } = await q;
    if (error) throw error;
    return { appointments: (data ?? []) as AppointmentRow[] };
  },
};

interface AppointmentRow {
  id: string;
  patient_phone: string;
  patient_name: string;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  price_eur: number;
  status: string;
  google_event_id: string;
  kind: string;
  notes?: string | null;
}

const cancelAppointment: Tool<{ appointment_id: string }, { ok: true }> = {
  name: "cancel_appointment",
  description: "Cancels an appointment (deletes the Google event, marks the row cancelled).",
  audience: "both",
  schema: { type: "object", properties: { appointment_id: { type: "string" } }, required: ["appointment_id"] },
  args: z.object({ appointment_id: z.string() }),
  async run({ appointment_id }, ctx) {
    const sb = supabaseAdmin();
    const { data: appt, error } = await sb.from("appointments").select("*").eq("id", appointment_id).maybeSingle();
    if (error) throw error;
    if (!appt) throw new Error("Appointment not found");
    if (!ctx.isOwner && ctx.callerPhone && appt.patient_phone !== ctx.callerPhone) {
      throw new Error("Cannot cancel another patient's appointment");
    }
    if (appt.google_event_id) await deleteCalendarEvent(appt.google_event_id);
    await sb.from("appointments").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", appointment_id);
    return { ok: true };
  },
};

const rescheduleAppointment: Tool<
  { appointment_id: string; new_starts_at: string; duration_min?: 30 | 60 },
  { ok: true; when: string }
> = {
  name: "reschedule_appointment",
  description: "Moves an appointment to a new start time.",
  audience: "both",
  schema: {
    type: "object",
    properties: {
      appointment_id: { type: "string" },
      new_starts_at: { type: "string" },
      duration_min: { type: "integer", enum: [30, 60] },
    },
    required: ["appointment_id", "new_starts_at"],
  },
  args: z.object({
    appointment_id: z.string(),
    new_starts_at: z.string(),
    duration_min: z.union([z.literal(30), z.literal(60)]).optional(),
  }),
  async run({ appointment_id, new_starts_at, duration_min }, ctx) {
    const sb = supabaseAdmin();
    const { data: appt } = await sb.from("appointments").select("*").eq("id", appointment_id).maybeSingle();
    if (!appt) throw new Error("Appointment not found");
    if (!ctx.isOwner && ctx.callerPhone && appt.patient_phone !== ctx.callerPhone) {
      throw new Error("Cannot reschedule another patient's appointment");
    }
    const startsAt = new Date(new_starts_at);
    const dur = (duration_min ?? appt.duration_min) as 30 | 60;
    if (appt.google_event_id) {
      await updateCalendarEvent(appt.google_event_id, { startsAt, durationMin: dur });
    }
    const endsAt = new Date(startsAt.getTime() + dur * 60_000);
    await sb
      .from("appointments")
      .update({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_min: dur,
        reminder_24h_sent_at: null,
        reminder_2h_sent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointment_id);
    return { ok: true, when: formatWhen(startsAt) };
  },
};

const updatePatient: Tool<
  { full_name?: string; email?: string; reason?: string; language?: "es" | "en" },
  { ok: true }
> = {
  name: "update_patient",
  description: "Persist or update patient information (name, email, reason, language).",
  audience: "both",
  schema: {
    type: "object",
    properties: {
      full_name: { type: "string" },
      email: { type: "string" },
      reason: { type: "string" },
      language: { type: "string", enum: ["es", "en"] },
    },
  },
  args: z.object({
    full_name: z.string().optional(),
    email: z.string().email().optional(),
    reason: z.string().optional(),
    language: z.enum(["es", "en"]).optional(),
  }),
  async run(input, ctx) {
    if (!ctx.callerPhone) throw new Error("update_patient requires caller phone");
    const sb = supabaseAdmin();
    await sb
      .from("patients")
      .upsert(
        {
          phone: ctx.callerPhone,
          full_name: input.full_name,
          email: input.email,
          reason: input.reason,
          language: input.language ?? "es",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone" },
      );
    return { ok: true };
  },
};

const listPendingApprovals: Tool<Record<string, never>, { pending: AppointmentRow[] }> = {
  name: "list_pending_approvals",
  description: "Owner only. Returns all extended-hours requests waiting for owner approval, oldest first.",
  audience: "owner",
  schema: { type: "object", properties: {} },
  args: z.object({}) as unknown as z.ZodType<Record<string, never>>,
  async run() {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("appointments")
      .select("*")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });
    return { pending: (data ?? []) as AppointmentRow[] };
  },
};

const approveAppointment: Tool<
  { appointment_id: string },
  { ok: true; google_event_id: string; when: string }
> = {
  name: "approve_appointment",
  description:
    "Owner only. Approves a pending extended-hours request: creates the Google Calendar event and notifies the patient.",
  audience: "owner",
  schema: { type: "object", properties: { appointment_id: { type: "string" } }, required: ["appointment_id"] },
  args: z.object({ appointment_id: z.string() }),
  async run({ appointment_id }) {
    const sb = supabaseAdmin();
    const { data: appt } = await sb.from("appointments").select("*").eq("id", appointment_id).maybeSingle();
    if (!appt) throw new Error("Appointment not found");
    if (appt.status !== "pending_approval") {
      throw new Error(`Appointment status is ${appt.status}, cannot approve`);
    }

    const startsAt = new Date(appt.starts_at);
    const { data: patient } = await sb
      .from("patients")
      .select("email,language")
      .eq("phone", appt.patient_phone)
      .maybeSingle();

    const event = await createCalendarEvent({
      patientName: appt.patient_name ?? "Paciente",
      patientEmail: patient?.email ?? undefined,
      patientPhone: appt.patient_phone,
      startsAt,
      durationMin: appt.duration_min as 30 | 60,
      notes: appt.notes ?? undefined,
    });

    await sb
      .from("appointments")
      .update({
        status: "confirmed",
        google_event_id: event.id,
        confirmation_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointment_id);

    const lang = (patient?.language ?? "es") as "es" | "en";
    const when = formatWhen(startsAt, lang);
    const address = env.clinicAddress();
    const price = appt.price_eur;
    const msg =
      lang === "en"
        ? `✅ Confirmed! Your appointment is ${when}.\n💶 ${price}€ (paid in person).\n📍 ${address}\n\nI'll remind you 24h and 2h before.`
        : `✅ ¡Confirmado! Tu cita es ${when}.\n💶 ${price}€ (cobro presencial).\n📍 ${address}\n\nTe recordaré 24h y 2h antes.`;
    try {
      await sendWhatsApp(appt.patient_phone, msg, { kind: "approval_confirmed", appointment_id });
    } catch (err) {
      console.error("[approveAppointment] notify patient failed", err);
    }

    return { ok: true, google_event_id: event.id!, when };
  },
};

const rejectAppointment: Tool<{ appointment_id: string; reason?: string }, { ok: true }> = {
  name: "reject_appointment",
  description:
    "Owner only. Rejects a pending extended-hours request and notifies the patient, optionally with a reason.",
  audience: "owner",
  schema: {
    type: "object",
    properties: { appointment_id: { type: "string" }, reason: { type: "string" } },
    required: ["appointment_id"],
  },
  args: z.object({ appointment_id: z.string(), reason: z.string().optional() }),
  async run({ appointment_id, reason }) {
    const sb = supabaseAdmin();
    const { data: appt } = await sb.from("appointments").select("*").eq("id", appointment_id).maybeSingle();
    if (!appt) throw new Error("Appointment not found");
    if (appt.status !== "pending_approval") {
      throw new Error(`Appointment status is ${appt.status}, cannot reject`);
    }

    await sb
      .from("appointments")
      .update({ status: "cancelled", notes: reason, updated_at: new Date().toISOString() })
      .eq("id", appointment_id);

    const { data: patient } = await sb.from("patients").select("language").eq("phone", appt.patient_phone).maybeSingle();
    const lang = (patient?.language ?? "es") as "es" | "en";
    const when = formatWhen(new Date(appt.starts_at), lang);
    const msg =
      lang === "en"
        ? `Sorry, the requested time (${when}) is not available.${reason ? ` Reason: ${reason}.` : ""} Would you like me to find another slot during regular hours?`
        : `Lo siento, la hora solicitada (${when}) no es posible.${reason ? ` Motivo: ${reason}.` : ""} ¿Quieres que busque otro hueco dentro del horario habitual?`;
    try {
      await sendWhatsApp(appt.patient_phone, msg, { kind: "approval_rejected", appointment_id });
    } catch (err) {
      console.error("[rejectAppointment] notify patient failed", err);
    }
    return { ok: true };
  },
};

const setWorkingHours: Tool<{ schedule: ScheduleConfig }, { ok: true }> = {
  name: "set_working_hours",
  description:
    "Owner only. Replace the working schedule. Always call get_working_hours first, modify only the relevant day(s), then pass the FULL config back. Each window has {start: 'HH:MM', end: 'HH:MM', mode: 'core' | 'extended'}. 'core' = auto-confirmed, 'extended' = needs owner approval. Days are mon..sun. Empty array means closed that day. Example: { timezone: 'Europe/Madrid', slot_minutes: 30, days: { mon: [{start: '09:00', end: '20:00', mode: 'core'}], ..., sat: [{start: '10:00', end: '13:00', mode: 'extended'}], sun: [] } }.",
  audience: "owner",
  schema: { type: "object", properties: { schedule: { type: "object" } }, required: ["schedule"] },
  args: z.object({ schedule: z.any() as unknown as z.ZodType<ScheduleConfig> }),
  async run({ schedule }) {
    await setSchedule(schedule);
    return { ok: true };
  },
};

const getWorkingHours: Tool<Record<string, never>, ScheduleConfig> = {
  name: "get_working_hours",
  description: "Returns the current working schedule.",
  audience: "owner",
  schema: { type: "object", properties: {} },
  args: z.object({}) as unknown as z.ZodType<Record<string, never>>,
  async run() {
    return await getSchedule();
  },
};

const blockSlot: Tool<{ starts_at: string; ends_at: string; reason?: string }, { event_id: string }> = {
  name: "block_slot",
  description: "Owner only. Creates a busy block in Google Calendar (vacation, lunch, etc).",
  audience: "owner",
  schema: {
    type: "object",
    properties: { starts_at: { type: "string" }, ends_at: { type: "string" }, reason: { type: "string" } },
    required: ["starts_at", "ends_at"],
  },
  args: z.object({ starts_at: z.string(), ends_at: z.string(), reason: z.string().optional() }),
  async run({ starts_at, ends_at, reason }) {
    const startsAt = new Date(starts_at);
    const dur = ((new Date(ends_at).getTime() - startsAt.getTime()) / 60_000) | 0;
    const event = await createCalendarEvent({
      patientName: `BLOQUEADO${reason ? ` — ${reason}` : ""}`,
      patientPhone: "owner",
      startsAt,
      durationMin: (dur >= 60 ? 60 : 30) as 30 | 60,
      notes: reason,
    });
    return { event_id: event.id! };
  },
};

const sendManualMessage: Tool<{ phone: string; body: string }, { ok: true }> = {
  name: "send_manual_message",
  description: "Owner only. Send a manual WhatsApp message to a patient.",
  audience: "owner",
  schema: {
    type: "object",
    properties: { phone: { type: "string" }, body: { type: "string" } },
    required: ["phone", "body"],
  },
  args: z.object({ phone: z.string(), body: z.string() }),
  async run({ phone, body }) {
    await sendWhatsApp(phone, body);
    return { ok: true };
  },
};

const getStats: Tool<
  { from?: string; to?: string },
  { total: number; sessions: number; followups: number; revenue_eur: number; no_shows: number }
> = {
  name: "get_stats",
  description: "Owner only. Aggregate stats for the requested period (defaults: current month).",
  audience: "owner",
  schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
  args: z.object({ from: z.string().optional(), to: z.string().optional() }),
  async run({ from, to }) {
    const sb = supabaseAdmin();
    const now = new Date();
    const fromD = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toD = to ? new Date(to) : addDays(fromD, 35);
    const { data } = await sb
      .from("appointments")
      .select("duration_min,price_eur,status,kind")
      .gte("starts_at", fromD.toISOString())
      .lte("starts_at", toD.toISOString());
    const rows = data ?? [];
    const confirmed = rows.filter((r) => r.status === "confirmed");
    return {
      total: confirmed.length,
      sessions: confirmed.filter((r) => r.kind === "session").length,
      followups: confirmed.filter((r) => r.kind === "followup").length,
      revenue_eur: confirmed.reduce((a, r) => a + (r.price_eur ?? 0), 0),
      no_shows: rows.filter((r) => r.status === "no_show").length,
    };
  },
};

const listCalendarEvents: Tool<{ from: string; to: string }, { events: unknown[] }> = {
  name: "list_calendar_events",
  description: "Owner only. Raw Google Calendar events between two timestamps.",
  audience: "owner",
  schema: {
    type: "object",
    properties: { from: { type: "string" }, to: { type: "string" } },
    required: ["from", "to"],
  },
  args: z.object({ from: z.string(), to: z.string() }),
  async run({ from, to }) {
    const events = await listEvents(new Date(from), new Date(to));
    return { events };
  },
};

export const ALL_TOOLS = [
  checkAvailability,
  bookAppointment,
  listAppointments,
  cancelAppointment,
  rescheduleAppointment,
  updatePatient,
  listPendingApprovals,
  approveAppointment,
  rejectAppointment,
  setWorkingHours,
  getWorkingHours,
  blockSlot,
  sendManualMessage,
  getStats,
  listCalendarEvents,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as unknown as Tool<any, any>[];

export function toolsFor(audience: "patient" | "owner") {
  return ALL_TOOLS.filter((t) => t.audience === "both" || t.audience === audience);
}

export function toDeepSeekTools(tools: Tool<unknown, unknown>[]): ToolSpec[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.schema },
  }));
}

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<unknown> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (tool.audience === "owner" && !ctx.isOwner) {
    throw new Error(`Tool ${name} is owner-only`);
  }
  const args = tool.args.parse(rawArgs);
  return await tool.run(args, ctx);
}
