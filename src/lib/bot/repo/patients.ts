import {
  buildInsert,
  getPool,
  query,
  queryExactlyOne,
  queryOne,
  type Queryable,
} from "../db";
import type { PatientRow } from "./types";

export interface PatientInsert {
  phone: string;
  full_name?: string | null;
  email?: string | null;
  reason?: string | null;
  language?: string;
  is_owner?: boolean;
  notes?: string | null;
}

/**
 * Campos que `update_patient` envía. Igual que en `supabase-js`, las claves con
 * valor `undefined` no viajan: al haber conflicto de teléfono NO se pisan esas
 * columnas (por ejemplo, guardar solo el email conserva el nombre).
 */
export interface PatientUpsert {
  phone: string;
  full_name?: string | null;
  email?: string | null;
  reason?: string | null;
  language?: string;
  updated_at?: string;
}

export async function getPatientByPhone(
  phone: string,
  db: Queryable = getPool(),
): Promise<PatientRow | null> {
  return await queryOne<PatientRow>(`select * from patients where phone = $1`, [phone], db);
}

export async function insertPatient(
  values: PatientInsert,
  db: Queryable = getPool(),
): Promise<PatientRow> {
  const { columns, placeholders, params } = buildInsert(values);
  return await queryExactlyOne<PatientRow>(
    `insert into patients (${columns}) values (${placeholders}) returning *`,
    params,
    db,
  );
}

export async function upsertPatientByPhone(
  values: PatientUpsert,
  db: Queryable = getPool(),
): Promise<void> {
  const { columns, placeholders, params } = buildInsert(values);
  const updatable = columns
    .split(", ")
    .filter((c) => c !== "phone")
    .map((c) => `${c} = excluded.${c}`);

  const onConflict = updatable.length
    ? `do update set ${updatable.join(", ")}`
    : "do nothing";

  await query(
    `insert into patients (${columns}) values (${placeholders})
     on conflict (phone) ${onConflict}`,
    params,
    db,
  );
}
