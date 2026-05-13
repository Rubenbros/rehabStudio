import { addDays, addMinutes, format, isAfter, isBefore, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { supabaseAdmin } from "./supabase";
import { getBusyIntervals } from "./calendar";
import { env } from "./env";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface ScheduleConfig {
  timezone: string;
  slot_minutes: number;
  days: Record<DayKey, { start: string; end: string }[]>;
}

export async function getSchedule(): Promise<ScheduleConfig> {
  const { data } = await supabaseAdmin()
    .from("config")
    .select("value")
    .eq("key", "schedule")
    .maybeSingle();
  if (!data) {
    return {
      timezone: env.clinicTimezone(),
      slot_minutes: 30,
      days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    };
  }
  return data.value as ScheduleConfig;
}

export async function setSchedule(next: ScheduleConfig) {
  await supabaseAdmin()
    .from("config")
    .upsert({ key: "schedule", value: next, updated_at: new Date().toISOString() });
}

/**
 * Compute open slots between `from` and `to` for a given `durationMin`,
 * skipping busy intervals from Google Calendar.
 */
export async function findAvailableSlots(
  from: Date,
  to: Date,
  durationMin: 30 | 60,
): Promise<Date[]> {
  const schedule = await getSchedule();
  const busy = await getBusyIntervals(from, to);
  const tz = schedule.timezone;
  const step = schedule.slot_minutes;

  const slots: Date[] = [];
  let cursor = startOfDay(toZonedTime(from, tz));
  const limit = toZonedTime(to, tz);

  while (isBefore(cursor, limit)) {
    const dayKey = DAY_KEYS[cursor.getDay()];
    const windows = schedule.days[dayKey] ?? [];
    for (const w of windows) {
      const [sH, sM] = w.start.split(":").map(Number);
      const [eH, eM] = w.end.split(":").map(Number);
      const startZ = new Date(cursor);
      startZ.setHours(sH, sM, 0, 0);
      const endZ = new Date(cursor);
      endZ.setHours(eH, eM, 0, 0);
      let slot = startZ;
      while (isBefore(addMinutes(slot, durationMin), addMinutes(endZ, 1))) {
        const slotUtc = fromZonedTime(slot, tz);
        const slotEndUtc = addMinutes(slotUtc, durationMin);
        if (isAfter(slotUtc, from) && isBefore(slotEndUtc, to)) {
          const conflicts = busy.some(
            (b) => isBefore(b.start, slotEndUtc) && isAfter(b.end, slotUtc),
          );
          if (!conflicts) slots.push(slotUtc);
        }
        slot = addMinutes(slot, step);
      }
    }
    cursor = addDays(cursor, 1);
  }
  return slots;
}

export function formatWhen(d: Date, lang: "es" | "en" = "es"): string {
  const tz = env.clinicTimezone();
  const z = toZonedTime(d, tz);
  if (lang === "en") return format(z, "EEEE, MMM d 'at' HH:mm");
  return format(z, "EEEE d 'de' MMMM 'a las' HH:mm");
}
