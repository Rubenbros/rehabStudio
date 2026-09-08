import { Pool } from "pg";
import { env } from "./env";

/**
 * Cualquier cosa capaz de ejecutar SQL parametrizado: el `Pool` de `pg`, un
 * `PoolClient` dentro de una transacción o un doble de test. Los repositorios
 * lo aceptan como último argumento para poder testearlos sin base de datos.
 */
export interface Queryable {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

let pool: Pool | null = null;

/**
 * Pool perezoso: no se crea hasta la primera consulta, de modo que ni el
 * `next build` ni los tests unitarios necesitan una `DATABASE_URL` válida.
 *
 * `max: 5` porque la instancia de Cloud SQL es compartida entre varias apps.
 */
export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: env.databaseUrl(),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Un error en un cliente ocioso no debe tumbar el proceso.
  pool.on("error", (err) => console.error("[db] idle client error", err));
  return pool;
}

/** Cierra el pool (tests de integración y apagados controlados). */
export async function closePool(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
}

/**
 * `pg` devuelve `timestamptz` como `Date`; el resto del código (y los tipos de
 * fila) esperan cadenas ISO, que es lo que devolvía PostgREST. Normalizamos
 * aquí en lugar de tocar los type parsers globales de `pg`.
 */
function normalizeRow<T>(row: Record<string, unknown>): T {
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (value instanceof Date) row[key] = value.toISOString();
  }
  return row as T;
}

export async function query<T>(
  text: string,
  values: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T[]> {
  const result = await db.query(text, values);
  return (result.rows ?? []).map((r) => normalizeRow<T>(r));
}

export async function queryOne<T>(
  text: string,
  values: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T | null> {
  const rows = await query<T>(text, values, db);
  return rows[0] ?? null;
}

/**
 * Equivalente a `.single()` de PostgREST: exige que la consulta devuelva fila.
 */
export async function queryExactlyOne<T>(
  text: string,
  values: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T> {
  const row = await queryOne<T>(text, values, db);
  if (!row) throw new Error("Expected exactly one row, got none");
  return row;
}

/** JSONB: `pg` serializa arrays como arrays de Postgres, así que van explícitos. */
export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * Construye la lista de columnas/placeholders de un INSERT ignorando las claves
 * con valor `undefined`, que es lo que hacía `supabase-js` al serializar el
 * cuerpo a JSON (una clave ausente deja actuar al DEFAULT de la columna).
 * `null` sí se envía.
 */
export function buildInsert(values: object): {
  columns: string;
  placeholders: string;
  params: unknown[];
} {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  if (entries.length === 0) throw new Error("buildInsert: no columns to insert");
  return {
    columns: entries.map(([k]) => k).join(", "),
    placeholders: entries.map((_, i) => `$${i + 1}`).join(", "),
    params: entries.map(([, v]) => v),
  };
}

/**
 * Construye el `SET` de un UPDATE ignorando las claves `undefined` (mismo
 * criterio que `buildInsert`: lo omitido no se toca). `startAt` es el índice
 * del primer placeholder.
 */
export function buildSet(
  values: object,
  startAt = 1,
): { assignments: string; params: unknown[] } {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  if (entries.length === 0) throw new Error("buildSet: no columns to update");
  return {
    assignments: entries.map(([k], i) => `${k} = $${i + startAt}`).join(", "),
    params: entries.map(([, v]) => v),
  };
}
