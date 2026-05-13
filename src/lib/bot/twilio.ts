import twilio from "twilio";
import { env } from "./env";
import { supabaseAdmin } from "./supabase";

let cached: ReturnType<typeof twilio> | null = null;

function client() {
  if (!cached) cached = twilio(env.twilioSid(), env.twilioToken());
  return cached;
}

function toWhatsApp(phone: string): string {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}

export async function sendWhatsApp(phone: string, body: string, meta: Record<string, unknown> = {}) {
  const to = toWhatsApp(phone);
  const from = env.twilioFrom();
  const msg = await client().messages.create({ from, to, body });
  await supabaseAdmin()
    .from("message_log")
    .insert({
      phone: phone.replace(/^whatsapp:/, ""),
      direction: "outbound",
      body,
      meta: { sid: msg.sid, ...meta },
    });
  return msg.sid;
}
