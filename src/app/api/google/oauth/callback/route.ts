import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { env } from "@/lib/bot/env";

export const runtime = "nodejs";

/**
 * One-shot callback. Trades the auth code for a refresh token and shows it on
 * the page so the operator can paste it into GOOGLE_REFRESH_TOKEN.
 *
 * In production you can disable this route once configured.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return new NextResponse("Missing ?code", { status: 400 });

  const oauth2 = new google.auth.OAuth2(
    env.googleClientId(),
    env.googleClientSecret(),
    env.googleRedirectUri(),
  );
  const { tokens } = await oauth2.getToken(code);

  const html = `<!doctype html><html><body style="font-family:system-ui;padding:2rem;max-width:48rem;margin:auto">
    <h1>Google Calendar conectado</h1>
    <p>Copia este <code>refresh_token</code> a <code>GOOGLE_REFRESH_TOKEN</code> en tus env vars:</p>
    <pre style="background:#f4f4f5;padding:1rem;border-radius:8px;word-break:break-all">${tokens.refresh_token ?? "(no refresh_token — revoca el acceso en https://myaccount.google.com/permissions y vuelve a /api/google/oauth/start)"}</pre>
    <p>Después borra esta ruta o deja que sólo el dueño la conozca.</p>
  </body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
