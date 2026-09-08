function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  /**
   * Cloud SQL (PostgreSQL). En Cloud Run va por socket Unix del conector:
   * postgresql://user:pass@localhost/db?host=/cloudsql/<INSTANCE_CONNECTION_NAME>
   */
  databaseUrl: () => required("DATABASE_URL"),

  twilioSid: () => required("TWILIO_ACCOUNT_SID"),
  twilioToken: () => required("TWILIO_AUTH_TOKEN"),
  twilioFrom: () => required("TWILIO_WHATSAPP_FROM"),

  deepseekKey: () => required("DEEPSEEK_API_KEY"),
  deepseekModel: () => optional("DEEPSEEK_MODEL", "deepseek-chat"),
  deepseekBase: () => optional("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),

  googleClientId: () => required("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => required("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: () => required("GOOGLE_REDIRECT_URI"),
  googleRefreshToken: () => required("GOOGLE_REFRESH_TOKEN"),
  googleCalendarId: () => optional("GOOGLE_CALENDAR_ID", "primary"),

  ownerPhone: () => required("OWNER_PHONE"),
  ownerEmail: () => optional("OWNER_EMAIL"),
  clinicName: () => optional("CLINIC_NAME", "rehabStudio"),
  clinicTimezone: () => optional("CLINIC_TIMEZONE", "Europe/Madrid"),
  clinicAddress: () => optional("CLINIC_ADDRESS", ""),
  sessionPrice: () => Number(optional("SESSION_PRICE_EUR", "60")),
  followupPrice: () => Number(optional("FOLLOWUP_PRICE_EUR", "30")),

  cronSecret: () => required("CRON_SECRET"),
  mcpToken: () => required("MCP_BEARER_TOKEN"),
};
