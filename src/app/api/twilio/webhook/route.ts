import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import twilio from "twilio";
import { handleInbound } from "@/lib/bot/orchestrator";
import { sendWhatsApp } from "@/lib/bot/twilio";
import {
  verifyTwilioSignature,
  checkRateLimit,
  rateLimitMessage,
} from "@/lib/bot/security";
import { detectLang } from "@/lib/bot/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_LEN = 1000;

/**
 * Twilio WhatsApp inbound webhook.
 *
 * Returns TwiML <Response/> immediately so Twilio doesn't time out, and uses
 * `after()` to keep the lambda alive long enough to call the LLM and reply
 * via the Twilio REST API.
 *
 * Defenses:
 *  - Twilio signature validation (rejects spoofed callers)
 *  - Per-phone rate limiting (5/min, 30/h, 100/day)
 *  - Body length cap
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // Reconstruct the public URL Twilio called (Vercel passes it via x-forwarded-*).
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const url = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const signature = req.headers.get("x-twilio-signature") ?? "";

  if (!verifyTwilioSignature(url, params, signature)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const fromRaw = params["From"] ?? "";
  const rawBody = (params["Body"] ?? "").trim();

  if (fromRaw && rawBody) {
    const phone = fromRaw.replace(/^whatsapp:/, "");
    const body = rawBody.slice(0, MAX_BODY_LEN);
    const lang = detectLang(body);

    after(async () => {
      try {
        const rl = await checkRateLimit(phone);
        if (!rl.allowed) {
          await sendWhatsApp(phone, rateLimitMessage(rl, lang));
          return;
        }
        const { reply } = await handleInbound(phone, body);
        if (reply) await sendWhatsApp(phone, reply);
      } catch (err) {
        console.error("[twilio webhook] handleInbound failed", err);
        try {
          await sendWhatsApp(
            phone,
            lang === "en"
              ? "Sorry, something went wrong. Please try again in a moment."
              : "Lo siento, ha ocurrido un error procesando tu mensaje. Inténtalo de nuevo en un momento.",
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
