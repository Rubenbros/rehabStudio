import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  listConfirmedNeedingFollowup,
  listConfirmedNeedingReminder,
  listStalePendingApprovals,
  updateAppointment,
} from "@/lib/bot/repo/appointments";
import { sendWhatsApp } from "@/lib/bot/twilio";
import { formatWhen } from "@/lib/bot/schedule";
import { env } from "@/lib/bot/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REMINDER_HOUR_LOCAL = 19; // 19:00 Madrid time

/**
 * Cron triggered every 30 min by GitHub Actions. Three jobs:
 *
 *  1) Day-before reminder: at the first tick after REMINDER_HOUR_LOCAL local
 *     time, ping every confirmed appointment happening tomorrow.
 *  2) D+10 follow-up: at the same evening window, ask patients who had a
 *     session 10 days ago how it went.
 *  3) Auto-reject pending approvals older than 2h (runs every tick).
 *
 *  Idempotent: each branch writes a `*_sent_at` timestamp so it never repeats.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const now = new Date();
  const tz = env.clinicTimezone();
  const madridNow = toZonedTime(now, tz);
  const inEveningWindow =
    madridNow.getHours() >= REMINDER_HOUR_LOCAL && madridNow.getHours() < REMINDER_HOUR_LOCAL + 1;

  let sentReminders = 0;
  let sentFollowups = 0;
  let autoRejected = 0;

  // 1) DAY-BEFORE REMINDER. Only at 19:00-19:59 Madrid.
  if (inEveningWindow) {
    const tomorrowMadrid = new Date(madridNow);
    tomorrowMadrid.setDate(tomorrowMadrid.getDate() + 1);
    tomorrowMadrid.setHours(0, 0, 0, 0);
    const dayAfterTomorrowMadrid = new Date(tomorrowMadrid);
    dayAfterTomorrowMadrid.setDate(dayAfterTomorrowMadrid.getDate() + 1);

    const fromUtc = fromZonedTime(tomorrowMadrid, tz).toISOString();
    const toUtc = fromZonedTime(dayAfterTomorrowMadrid, tz).toISOString();

    const tomorrowAppts = await listConfirmedNeedingReminder({ from: fromUtc, to: toUtc });

    for (const appt of tomorrowAppts) {
      const lang = (appt.patients?.language ?? "es") as "es" | "en";
      const whenStr = formatWhen(new Date(appt.starts_at), lang);
      const msg =
        lang === "en"
          ? `Reminder: your appointment is tomorrow, ${whenStr}. Reply CONFIRM to confirm or CANCEL to cancel.`
          : `Recordatorio: mañana tienes cita, ${whenStr}. Responde CONFIRMO para confirmar o CANCELAR para cancelar.`;
      try {
        await sendWhatsApp(appt.patient_phone, msg);
        await updateAppointment(appt.id, { reminder_24h_sent_at: new Date().toISOString() });
        sentReminders++;
      } catch (err) {
        console.error("[cron] reminder send failed", err);
      }
    }
  }

  // 2) D+10 FOLLOW-UP. Only at the same evening window so it doesn't ping
  //    patients at random times of day.
  if (inEveningWindow) {
    const tenDaysAgo = subDays(now, 10);
    const elevenDaysAgo = subDays(now, 11);

    const oldAppts = await listConfirmedNeedingFollowup({
      from: elevenDaysAgo.toISOString(),
      to: tenDaysAgo.toISOString(),
    });

    for (const appt of oldAppts) {
      const lang = (appt.patients?.language ?? "es") as "es" | "en";
      const msg =
        lang === "en"
          ? `Hi! It's been 10 days since your session — how have you been feeling? If you need a follow-up I'll happily find you a slot.`
          : `¡Hola! Han pasado 10 días desde tu última sesión, ¿qué tal te encuentras? Si necesitas otra cita o un seguimiento, dímelo y te busco hueco.`;
      try {
        await sendWhatsApp(appt.patient_phone, msg);
        await updateAppointment(appt.id, { followup_sent_at: new Date().toISOString() });
        sentFollowups++;
      } catch (err) {
        console.error("[cron] followup send failed", err);
      }
    }
  }

  // 3) AUTO-REJECT pending approvals older than 2h. Runs every tick.
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const stalePending = await listStalePendingApprovals(twoHoursAgo.toISOString());

  for (const appt of stalePending) {
    const lang = (appt.patients?.language ?? "es") as "es" | "en";
    await updateAppointment(appt.id, {
      status: "cancelled",
      updated_at: new Date().toISOString(),
    });
    const when = formatWhen(new Date(appt.starts_at), lang);
    const msg =
      lang === "en"
        ? `Sorry, we couldn't confirm your requested slot (${when}). Reply "book" if you'd like another time during regular hours.`
        : `Lo siento, no hemos podido confirmar el hueco solicitado (${when}). Si quieres otro hueco en horario habitual, dímelo y te lo busco.`;
    try {
      await sendWhatsApp(appt.patient_phone, msg);
    } catch (err) {
      console.error("[cron] auto-reject notify failed", err);
    }
    autoRejected++;
  }

  return NextResponse.json({
    ok: true,
    madrid_now: madridNow.toISOString(),
    evening_window: inEveningWindow,
    sent: {
      reminder_day_before: sentReminders,
      followup_d10: sentFollowups,
      auto_rejected: autoRejected,
    },
  });
}

function authorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.cronSecret()}`;
}
