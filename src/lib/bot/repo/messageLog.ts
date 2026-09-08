import { getPool, json, query, type Queryable } from "../db";

export interface MessageLogInsert {
  phone: string;
  /** inbound | outbound */
  direction: string;
  body: string;
  meta?: Record<string, unknown>;
}

export async function insertMessage(
  values: MessageLogInsert,
  db: Queryable = getPool(),
): Promise<void> {
  if (values.meta === undefined) {
    await query(
      `insert into message_log (phone, direction, body) values ($1, $2, $3)`,
      [values.phone, values.direction, values.body],
      db,
    );
    return;
  }
  await query(
    `insert into message_log (phone, direction, body, meta) values ($1, $2, $3, $4::jsonb)`,
    [values.phone, values.direction, values.body, json(values.meta)],
    db,
  );
}

/**
 * Recuento para el rate limit: mensajes entrantes de un teléfono desde `since`.
 * Sustituye al `select("id", { count: "exact", head: true })` de PostgREST.
 */
export async function countInboundSince(
  phone: string,
  since: string,
  db: Queryable = getPool(),
): Promise<number> {
  const rows = await query<{ count: string | number }>(
    `select count(*)::int as count
       from message_log
      where phone = $1 and direction = $2 and created_at >= $3`,
    [phone, "inbound", since],
    db,
  );
  return Number(rows[0]?.count ?? 0);
}
