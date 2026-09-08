import {
  buildInsert,
  buildSet,
  getPool,
  query,
  queryExactlyOne,
  queryOne,
  type Queryable,
} from "../db";
import type { AppointmentRow, AppointmentWithPatientLanguage } from "./types";

/**
 * Columnas escribibles de `appointments`. Las claves con valor `undefined` se
 * omiten de la sentencia (deja actuar al DEFAULT en INSERT, no toca la columna
 * en UPDATE); `null` sí se escribe.
 */
export interface AppointmentInsert {
  patient_id?: string | null;
  patient_phone: string;
  patient_name?: string | null;
  google_event_id?: string | null;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  price_eur: number;
  kind?: string;
  status?: string;
  notes?: string | null;
  confirmation_sent_at?: string | null;
}

export interface AppointmentPatch {
  patient_name?: string | null;
  google_event_id?: string | null;
  starts_at?: string;
  ends_at?: string;
  duration_min?: number;
  price_eur?: number;
  kind?: string;
  status?: string;
  notes?: string | null;
  confirmation_sent_at?: string | null;
  reminder_24h_sent_at?: string | null;
  reminder_2h_sent_at?: string | null;
  followup_sent_at?: string | null;
  updated_at?: string;
}

/** Proyección que el orquestador inyecta en el prompt del owner. */
export type PendingApprovalRow = Pick<
  AppointmentRow,
  "id" | "patient_name" | "patient_phone" | "starts_at" | "duration_min" | "created_at"
>;

/** Proyección de `get_stats`. */
export type AppointmentStatsRow = Pick<
  AppointmentRow,
  "duration_min" | "price_eur" | "status" | "kind"
>;

/** LEFT JOIN que reproduce el embebido `patients(language)` de PostgREST. */
const WITH_PATIENT_LANGUAGE = `
  select a.*,
         case when p.id is null then null
              else jsonb_build_object('language', p.language)
         end as patients
    from appointments a
    left join patients p on p.id = a.patient_id`;

export async function insertAppointment(
  values: AppointmentInsert,
  db: Queryable = getPool(),
): Promise<AppointmentRow> {
  const { columns, placeholders, params } = buildInsert(values);
  return await queryExactlyOne<AppointmentRow>(
    `insert into appointments (${columns}) values (${placeholders}) returning *`,
    params,
    db,
  );
}

export async function getAppointmentById(
  id: string,
  db: Queryable = getPool(),
): Promise<AppointmentRow | null> {
  return await queryOne<AppointmentRow>(
    `select * from appointments where id = $1`,
    [id],
    db,
  );
}

export async function updateAppointment(
  id: string,
  patch: AppointmentPatch,
  db: Queryable = getPool(),
): Promise<void> {
  const { assignments, params } = buildSet(patch);
  await query(
    `update appointments set ${assignments} where id = $${params.length + 1}`,
    [...params, id],
    db,
  );
}

/**
 * `list_appointments`: rango sobre `starts_at`, nunca canceladas, opcionalmente
 * sin las pendientes de aprobación y/o filtradas por teléfono. Orden ascendente.
 */
export async function listAppointments(
  filters: {
    from: string;
    to: string;
    includePending?: boolean;
    patientPhone?: string;
  },
  db: Queryable = getPool(),
): Promise<AppointmentRow[]> {
  const conditions = ["starts_at >= $1", "starts_at <= $2", "status <> $3"];
  const params: unknown[] = [filters.from, filters.to, "cancelled"];

  if (!filters.includePending) {
    params.push("pending_approval");
    conditions.push(`status <> $${params.length}`);
  }
  if (filters.patientPhone) {
    params.push(filters.patientPhone);
    conditions.push(`patient_phone = $${params.length}`);
  }

  return await query<AppointmentRow>(
    `select * from appointments where ${conditions.join(" and ")} order by starts_at asc`,
    params,
    db,
  );
}

/** Citas en espera de aprobación del owner, la más antigua primero. */
export async function listPendingApprovals(
  db: Queryable = getPool(),
): Promise<AppointmentRow[]> {
  return await query<AppointmentRow>(
    `select * from appointments where status = $1 order by created_at asc`,
    ["pending_approval"],
    db,
  );
}

/** Igual que `listPendingApprovals` pero solo con lo que va al prompt. */
export async function listPendingApprovalSummaries(
  db: Queryable = getPool(),
): Promise<PendingApprovalRow[]> {
  return await query<PendingApprovalRow>(
    `select id, patient_name, patient_phone, starts_at, duration_min, created_at
       from appointments
      where status = $1
      order by created_at asc`,
    ["pending_approval"],
    db,
  );
}

export async function listAppointmentStats(
  range: { from: string; to: string },
  db: Queryable = getPool(),
): Promise<AppointmentStatsRow[]> {
  return await query<AppointmentStatsRow>(
    `select duration_min, price_eur, status, kind
       from appointments
      where starts_at >= $1 and starts_at <= $2`,
    [range.from, range.to],
    db,
  );
}

/** Cron 1: citas confirmadas de mañana sin recordatorio enviado. */
export async function listConfirmedNeedingReminder(
  range: { from: string; to: string },
  db: Queryable = getPool(),
): Promise<AppointmentWithPatientLanguage[]> {
  return await query<AppointmentWithPatientLanguage>(
    `${WITH_PATIENT_LANGUAGE}
   where a.starts_at >= $1
     and a.starts_at < $2
     and a.status = $3
     and a.reminder_24h_sent_at is null`,
    [range.from, range.to, "confirmed"],
    db,
  );
}

/** Cron 2: citas terminadas hace 10-11 días sin seguimiento enviado. */
export async function listConfirmedNeedingFollowup(
  range: { from: string; to: string },
  db: Queryable = getPool(),
): Promise<AppointmentWithPatientLanguage[]> {
  return await query<AppointmentWithPatientLanguage>(
    `${WITH_PATIENT_LANGUAGE}
   where a.ends_at >= $1
     and a.ends_at <= $2
     and a.status = $3
     and a.followup_sent_at is null`,
    [range.from, range.to, "confirmed"],
    db,
  );
}

/** Cron 3: solicitudes pendientes creadas antes de `before` (auto-rechazo). */
export async function listStalePendingApprovals(
  before: string,
  db: Queryable = getPool(),
): Promise<AppointmentWithPatientLanguage[]> {
  return await query<AppointmentWithPatientLanguage>(
    `${WITH_PATIENT_LANGUAGE}
   where a.status = $1
     and a.created_at <= $2`,
    ["pending_approval", before],
    db,
  );
}
