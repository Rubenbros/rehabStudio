function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/**
 * Como `optional`, pero una variable definida y vacía también cae al valor por
 * defecto. Cloud Run inyecta `VAR=` (cadena vacía) cuando la variable de GitHub
 * no existe, y ahí un valor vacío rompería la URL o el id de modelo.
 */
function optionalNonEmpty(name: string, fallback: string): string {
  return process.env[name] || fallback;
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

  /**
   * Vertex AI (Gemini). Sin API key: la autenticación va por ADC (la cuenta de
   * servicio en Cloud Run, `gcloud auth application-default login` en local).
   * GOOGLE_CLOUD_PROJECT es opcional: si falta, se deduce por ADC.
   */
  googleCloudProject: () => optional("GOOGLE_CLOUD_PROJECT"),
  vertexLocation: () => optionalNonEmpty("VERTEX_LOCATION", "europe-west1"),
  geminiModel: () => optionalNonEmpty("GEMINI_MODEL", "google/gemini-2.5-flash"),

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
