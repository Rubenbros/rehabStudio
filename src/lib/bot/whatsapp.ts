import { env } from "./env";
import { supabaseAdmin } from "./supabase";

/** Meta expects the recipient as digits with country code, no '+' or prefix. */
function normalizeTo(phone: string): string {
  return phone.replace(/^whatsapp:/, "").replace(/\D/g, "");
}

export async function sendWhatsApp(phone: string, body: string, meta: Record<string, unknown> = {}) {
  const to = normalizeTo(phone);
  const url = `https://graph.facebook.com/${env.whatsappApiVersion()}/${env.whatsappPhoneNumberId()}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.whatsappToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${data?.error?.message ?? res.statusText}`);
  }
  const wamid = data?.messages?.[0]?.id;

  await supabaseAdmin()
    .from("message_log")
    .insert({
      phone: phone.replace(/^whatsapp:/, ""),
      direction: "outbound",
      body,
      meta: { wamid, ...meta },
    });
  return wamid;
}
