function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  whatsappPhoneNumberId: () => required("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappToken: () => required("WHATSAPP_ACCESS_TOKEN"),
  whatsappVerifyToken: () => required("WHATSAPP_VERIFY_TOKEN"),
  whatsappAppSecret: () => required("WHATSAPP_APP_SECRET"),
  whatsappApiVersion: () => optional("WHATSAPP_API_VERSION", "v21.0"),

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
