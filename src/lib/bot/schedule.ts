import { addDays, addMinutes, format, isAfter, isBefore, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getConfigValue, upsertConfigValue } from "./repo/config";
import { getBusyIntervals } from "./calendar";
import { env } from "./env";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type SlotMode = "core" | "extended";

export interface ScheduleWindow {
  start: string;
  end: string;
  /** Defaults to "core" when missing for backward compatibility. */
  mode?: SlotMode;
}

export interface ScheduleConfig {
  timezone: string;
  slot_minutes: number;
  days: Record<DayKey, ScheduleWindow[]>;
}

export interface AvailableSlot {
  time: Date;
  mode: SlotMode;
}

export async function getSchedule(): Promise<ScheduleConfig> {
  const value = await getConfigValue<ScheduleConfig>("schedule");
  if (!value) {
    return {
      timezone: env.clinicTimezone(),
      slot_minutes: 30,
      days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    };
  }
  return value;
}

export async function setSchedule(next: ScheduleConfig) {
  await upsertConfigValue("schedule", next, new Date().toISOString());
}

/**
 * Compute open slots between `from` and `to` for a given `durationMin`,
 * skipping busy intervals from Google Calendar. Each slot is tagged with the
 * mode of its containing window ("core" or "extended").
 */
export async function findAvailableSlots(
  from: Date,
  to: Date,
  durationMin: 30 | 60,
): Promise<AvailableSlot[]> {
  const schedule = await getSchedule();
  const busy = await getBusyIntervals(from, to);
  const tz = schedule.timezone;
  const step = schedule.slot_minutes;

  const slots: AvailableSlot[] = [];
  let cursor = startOfDay(toZonedTime(from, tz));
  const limit = toZonedTime(to, tz);

  while (isBefore(cursor, limit)) {
    const dayKey = DAY_KEYS[cursor.getDay()];
    const windows = schedule.days[dayKey] ?? [];
    for (const w of windows) {
      const mode: SlotMode = w.mode ?? "core";
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
          if (!conflicts) slots.push({ time: slotUtc, mode });
        }
        slot = addMinutes(slot, step);
      }
    }
    cursor = addDays(cursor, 1);
  }
  return slots;
}

/**
 * Look up which mode (core/extended) covers a given start time, or null if
 * the time falls outside any working window.
 */
export async function modeForStartTime(startsAt: Date): Promise<SlotMode | null> {
  const schedule = await getSchedule();
  const tz = schedule.timezone;
  const z = toZonedTime(startsAt, tz);
  const dayKey = DAY_KEYS[z.getDay()];
  const windows = schedule.days[dayKey] ?? [];
  for (const w of windows) {
    const [sH, sM] = w.start.split(":").map(Number);
    const [eH, eM] = w.end.split(":").map(Number);
    const start = new Date(z);
    start.setHours(sH, sM, 0, 0);
    const end = new Date(z);
    end.setHours(eH, eM, 0, 0);
    if (z >= start && z < end) return w.mode ?? "core";
  }
  return null;
}

export function formatWhen(d: Date, lang: "es" | "en" = "es"): string {
  const tz = env.clinicTimezone();
  const z = toZonedTime(d, tz);
  if (lang === "en") return format(z, "EEEE, MMM d 'at' HH:mm");
  return format(z, "EEEE d 'de' MMMM 'a las' HH:mm");
}
