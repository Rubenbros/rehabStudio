import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { handleInbound } from "@/lib/bot/orchestrator";
import { sendWhatsApp } from "@/lib/bot/whatsapp";
import { verifyMetaSignature, checkRateLimit, rateLimitMessage } from "@/lib/bot/security";
import { detectLang } from "@/lib/bot/i18n";
import { env } from "@/lib/bot/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_LEN = 1000;

/**
 * WhatsApp Cloud API webhook verification handshake. Meta calls this once when
 * you register the callback URL and expects the `hub.challenge` echoed back.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === env.whatsappVerifyToken()) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * WhatsApp Cloud API inbound webhook.
 *
 * Returns 200 immediately so Meta doesn't retry, and uses `after()` to keep the
 * lambda alive long enough to call DeepSeek and reply via the Graph API.
 *
 * Defenses:
 *  - X-Hub-Signature-256 validation over the raw body (rejects spoofed callers)
 *  - Per-phone rate limiting (5/min, 30/h, 100/day)
 *  - Body length cap
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifyMetaSignature(raw, signature)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(raw) as MetaWebhookPayload;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const msg = extractFirstTextMessage(payload);
  if (msg) {
    // Meta delivers the sender as digits without '+'; the rest of the app keeps
    // phones in E.164 with the leading '+'.
    const phone = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
    const body = msg.body.trim().slice(0, MAX_BODY_LEN);

    if (body) {
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
          console.error("[whatsapp webhook] handleInbound failed", err);
          try {
            await sendWhatsApp(
              phone,
              lang === "en"
                ? "Sorry, something went wrong. Please try again in a moment."
                : "Lo siento, ha ocurrido un error procesando tu mensaje. Inténtalo de nuevo en un momento.",
            );
          } catch (e) {
            console.error("[whatsapp webhook] fallback send failed", e);
          }
        }
      });
    }
  }

  return new NextResponse(null, { status: 200 });
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
}

/** Returns the first inbound text message in the payload, ignoring status
 *  callbacks and non-text message types (images, buttons, etc.). */
function extractFirstTextMessage(payload: MetaWebhookPayload): { from: string; body: string } | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.type === "text" && m.from && m.text?.body) {
          return { from: m.from, body: m.text.body };
        }
      }
    }
  }
  return null;
}
