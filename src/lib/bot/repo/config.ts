import { getPool, json, query, queryOne, type Queryable } from "../db";

/**
 * Tabla clave/valor con la configuración editable en caliente (hoy solo la
 * clave `schedule`).
 */
export async function getConfigValue<T>(
  key: string,
  db: Queryable = getPool(),
): Promise<T | null> {
  const row = await queryOne<{ value: T }>(
    `select value from config where key = $1`,
    [key],
    db,
  );
  return row ? row.value : null;
}

export async function upsertConfigValue(
  key: string,
  value: unknown,
  updatedAt: string,
  db: Queryable = getPool(),
): Promise<void> {
  await query(
    `insert into config (key, value, updated_at) values ($1, $2::jsonb, $3)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [key, json(value), updatedAt],
    db,
  );
}
