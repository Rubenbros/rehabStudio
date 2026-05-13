import { NextResponse } from "next/server";
import { google } from "googleapis";
import { env } from "@/lib/bot/env";

export const runtime = "nodejs";

/**
 * Run this once with the owner's Google account to capture a refresh token.
 * After landing on /api/google/oauth/callback you'll receive a refresh_token
 * to paste into GOOGLE_REFRESH_TOKEN.
 */
export async function GET() {
  const oauth2 = new google.auth.OAuth2(
    env.googleClientId(),
    env.googleClientSecret(),
    env.googleRedirectUri(),
  );
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
  return NextResponse.redirect(url);
}
