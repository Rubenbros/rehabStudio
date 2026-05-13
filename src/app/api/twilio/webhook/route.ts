import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { handleInbound } from "@/lib/bot/orchestrator";
import { sendWhatsApp } from "@/lib/bot/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio WhatsApp inbound webhook.
 *
 * We respond with an empty TwiML <Response/> and send the actual reply via the
 * REST API. This keeps the response fast and lets us avoid hitting Twilio's
 * 15s webhook timeout while DeepSeek runs.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fromRaw = String(form.get("From") ?? ""); // "whatsapp:+34..."
  const body = String(form.get("Body") ?? "").trim();

  if (!fromRaw || !body) {
    return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
  }

  const phone = fromRaw.replace(/^whatsapp:/, "");

  // Fire-and-forget the heavy lifting so Twilio gets an immediate 200.
  (async () => {
    try {
      const { reply } = await handleInbound(phone, body);
      if (reply) await sendWhatsApp(phone, reply);
    } catch (err) {
      console.error("[twilio webhook]", err);
      try {
        await sendWhatsApp(
          phone,
          "Lo siento, ha ocurrido un error procesando tu mensaje. Inténtalo de nuevo en un momento.",
        );
      } catch {
        // swallow secondary error
      }
    }
  })();

  // Return empty TwiML so Twilio doesn't send anything itself.
  const twiml = new twilio.twiml.MessagingResponse();
  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
