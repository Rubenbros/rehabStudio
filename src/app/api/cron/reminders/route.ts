import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/bot/supabase";
import { sendWhatsApp } from "@/lib/bot/twilio";
import { formatWhen } from "@/lib/bot/schedule";
import { T } from "@/lib/bot/i18n";
import { env } from "@/lib/bot/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron that fires every 30 min. For each upcoming appointment, sends:
 *  - 24h reminder (between 22h and 26h before)
 *  - 2h reminder  (between 90 min and 150 min before)
 *  - D+1 follow-up after completed sessions
 *  - Auto-rejects pending_approval rows older than 2h
 *
 * Idempotent: each branch updates a `*_sent_at` column so it never sends twice.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const sb = supabaseAdmin();
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 60 * 60 * 1000); // 30h ahead

  const { data: upcoming, error } = await sb
    .from("appointments")
    .select("*, patients(language)")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString())
    .neq("status", "cancelled")
    .neq("status", "pending_approval");
  if (error) throw error;

  let sent24 = 0;
  let sent2 = 0;

  for (const appt of upcoming ?? []) {
    const startsAt = new Date(appt.starts_at);
    const minutesUntil = (startsAt.getTime() - now.getTime()) / 60_000;
    const lang = (appt.patients?.language ?? "es") as "es" | "en";
    const whenStr = formatWhen(startsAt, lang);

    if (!appt.reminder_24h_sent_at && minutesUntil <= 24 * 60 && minutesUntil > 6 * 60) {
      await sendWhatsApp(appt.patient_phone, T.reminder24[lang](whenStr));
      await sb
        .from("appointments")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      sent24++;
    }

    if (!appt.reminder_2h_sent_at && minutesUntil <= 150 && minutesUntil >= 60) {
      const timeOnly = startsAt.toLocaleTimeString(lang === "en" ? "en-US" : "es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: env.clinicTimezone(),
      });
      await sendWhatsApp(appt.patient_phone, T.reminder2[lang](timeOnly));
      await sb
        .from("appointments")
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      sent2++;
    }
  }

  // Follow-up D+1 for completed/past sessions.
  const yesterday = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 22 * 60 * 60 * 1000);
  const { data: pastDue } = await sb
    .from("appointments")
    .select("*, patients(language)")
    .gte("ends_at", yesterday.toISOString())
    .lte("ends_at", oneDayAgo.toISOString())
    .is("followup_sent_at", null)
    .neq("status", "cancelled");

  let sentFollowup = 0;
  for (const appt of pastDue ?? []) {
    const lang = (appt.patients?.language ?? "es") as "es" | "en";
    await sendWhatsApp(appt.patient_phone, T.followup[lang]);
    await sb
      .from("appointments")
      .update({ followup_sent_at: new Date().toISOString() })
      .eq("id", appt.id);
    sentFollowup++;
  }

  // Auto-reject pending approvals older than 2h with no owner response.
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const { data: stalePending } = await sb
    .from("appointments")
    .select("*, patients(language)")
    .eq("status", "pending_approval")
    .lte("created_at", twoHoursAgo.toISOString());

  let autoRejected = 0;
  for (const appt of stalePending ?? []) {
    const lang = (appt.patients?.language ?? "es") as "es" | "en";
    await sb
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appt.id);
    const when = formatWhen(new Date(appt.starts_at), lang);
    const msg =
      lang === "en"
        ? `Sorry, we couldn't confirm your requested slot (${when}). Reply with "book" if you'd like another time during regular hours.`
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
    sent: { r24: sent24, r2: sent2, followup: sentFollowup, auto_rejected: autoRejected },
  });
}

function authorized(req: NextRequest): boolean {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.cronSecret()}`;
}
