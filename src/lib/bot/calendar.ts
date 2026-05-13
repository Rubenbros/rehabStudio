import { google, calendar_v3 } from "googleapis";
import { env } from "./env";

let cached: calendar_v3.Calendar | null = null;

export function calendarClient(): calendar_v3.Calendar {
  if (cached) return cached;
  const oauth2 = new google.auth.OAuth2(
    env.googleClientId(),
    env.googleClientSecret(),
    env.googleRedirectUri(),
  );
  oauth2.setCredentials({ refresh_token: env.googleRefreshToken() });
  cached = google.calendar({ version: "v3", auth: oauth2 });
  return cached;
}

export interface AppointmentInput {
  patientName: string;
  patientEmail?: string;
  patientPhone: string;
  startsAt: Date;
  durationMin: 30 | 60;
  notes?: string;
}

export async function createCalendarEvent(input: AppointmentInput) {
  const cal = calendarClient();
  const end = new Date(input.startsAt.getTime() + input.durationMin * 60_000);
  const summary = `${input.patientName} (${input.durationMin}min) — ${input.patientPhone}`;
  const description = [
    `Paciente: ${input.patientName}`,
    `Teléfono: ${input.patientPhone}`,
    input.patientEmail ? `Email: ${input.patientEmail}` : null,
    input.notes ? `Motivo: ${input.notes}` : null,
    "",
    "Creado por bot WhatsApp",
  ]
    .filter(Boolean)
    .join("\n");

  const { data } = await cal.events.insert({
    calendarId: env.googleCalendarId(),
    sendUpdates: input.patientEmail ? "all" : "none",
    requestBody: {
      summary,
      description,
      start: { dateTime: input.startsAt.toISOString(), timeZone: env.clinicTimezone() },
      end: { dateTime: end.toISOString(), timeZone: env.clinicTimezone() },
      attendees: input.patientEmail ? [{ email: input.patientEmail, displayName: input.patientName }] : undefined,
      reminders: { useDefault: true },
    },
  });
  return data;
}

export async function deleteCalendarEvent(eventId: string) {
  const cal = calendarClient();
  await cal.events.delete({
    calendarId: env.googleCalendarId(),
    eventId,
    sendUpdates: "all",
  });
}

export async function updateCalendarEvent(
  eventId: string,
  patch: { startsAt?: Date; durationMin?: 30 | 60; notes?: string },
) {
  const cal = calendarClient();
  const existing = await cal.events.get({
    calendarId: env.googleCalendarId(),
    eventId,
  });

  let start = existing.data.start?.dateTime
    ? new Date(existing.data.start.dateTime)
    : new Date();
  let durationMin: 30 | 60 = 60;
  if (existing.data.end?.dateTime) {
    const diff = (new Date(existing.data.end.dateTime).getTime() - start.getTime()) / 60_000;
    durationMin = diff <= 30 ? 30 : 60;
  }

  if (patch.startsAt) start = patch.startsAt;
  if (patch.durationMin) durationMin = patch.durationMin;
  const end = new Date(start.getTime() + durationMin * 60_000);

  const { data } = await cal.events.patch({
    calendarId: env.googleCalendarId(),
    eventId,
    sendUpdates: "all",
    requestBody: {
      start: { dateTime: start.toISOString(), timeZone: env.clinicTimezone() },
      end: { dateTime: end.toISOString(), timeZone: env.clinicTimezone() },
      description: patch.notes ? `${existing.data.description ?? ""}\n${patch.notes}` : existing.data.description,
    },
  });
  return data;
}

/**
 * Returns busy intervals from Google Calendar between `from` and `to`.
 */
export async function getBusyIntervals(from: Date, to: Date) {
  const cal = calendarClient();
  const { data } = await cal.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      timeZone: env.clinicTimezone(),
      items: [{ id: env.googleCalendarId() }],
    },
  });
  const busy = data.calendars?.[env.googleCalendarId()]?.busy ?? [];
  return busy.map((b) => ({
    start: new Date(b.start!),
    end: new Date(b.end!),
  }));
}

export async function listEvents(from: Date, to: Date) {
  const cal = calendarClient();
  const { data } = await cal.events.list({
    calendarId: env.googleCalendarId(),
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return data.items ?? [];
}
