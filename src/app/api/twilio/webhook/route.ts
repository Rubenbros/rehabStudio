import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import twilio from "twilio";
import { handleInbound } from "@/lib/bot/orchestrator";
import { sendWhatsApp } from "@/lib/bot/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Twilio WhatsApp inbound webhook.
 *
 * We return TwiML <Response/> immediately so Twilio doesn't time out, and use
 * `after()` to keep the lambda alive long enough to call DeepSeek and reply
 * via the Twilio REST API.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fromRaw = String(form.get("From") ?? "");
  const body = String(form.get("Body") ?? "").trim();

  if (fromRaw && body) {
    const phone = fromRaw.replace(/^whatsapp:/, "");
    after(async () => {
      try {
        const { reply } = await handleInbound(phone, body);
        if (reply) await sendWhatsApp(phone, reply);
      } catch (err) {
        console.error("[twilio webhook] handleInbound failed", err);
        try {
          await sendWhatsApp(
            phone,
            "Lo siento, ha ocurrido un error procesando tu mensaje. Inténtalo de nuevo en un momento.",
          );
        } catch (e) {
          console.error("[twilio webhook] fallback send failed", e);
        }
      }
    });
  }

  const twiml = new twilio.twiml.MessagingResponse();
  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
