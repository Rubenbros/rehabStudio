/**
 * Tipos de fila de las seis tablas del bot. Reflejan el DDL de `db/schema.sql`
 * columna a columna: los `timestamptz` llegan como cadena ISO (ver
 * `normalizeRow` en `db.ts`) y los `jsonb` ya parseados.
 */

export interface PatientRow {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  reason: string | null;
  /** 'es' | 'en' — la columna es texto libre, sin CHECK. */
  language: string;
  is_owner: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  phone: string;
  state: string;
  context: Record<string, unknown>;
  messages: unknown[];
  last_active: string;
  created_at: string;
}

export interface AppointmentRow {
  id: string;
  patient_id: string | null;
  patient_phone: string;
  patient_name: string | null;
  google_event_id: string | null;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  price_eur: number;
  /** session | followup */
  kind: string;
  /** confirmed | cancelled | pending_approval | completed | no_show */
  status: string;
  notes: string | null;
  confirmation_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  followup_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Cita con el idioma del paciente embebido, equivalente al
 * `select("*, patients(language)")` de PostgREST: `null` cuando `patient_id`
 * es NULL o el paciente ya no existe.
 */
export interface AppointmentWithPatientLanguage extends AppointmentRow {
  patients: { language: string } | null;
}

export interface MessageLogRow {
  id: string;
  phone: string;
  /** inbound | outbound */
  direction: string;
  body: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface PendingQuestionRow {
  id: string;
  patient_phone: string;
  patient_name: string | null;
  question: string;
  /** pending | answered | abandoned */
  status: string;
  answer: string | null;
  asked_at: string;
  notified_owner_at: string | null;
  answered_at: string | null;
}

export interface ConfigRow {
  key: string;
  value: unknown;
  updated_at: string;
}
