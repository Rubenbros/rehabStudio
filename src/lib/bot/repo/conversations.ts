import { getPool, json, query, queryOne, type Queryable } from "../db";
import type { ConversationRow } from "./types";

export interface ConversationUpsert {
  phone: string;
  state: string;
  context: Record<string, unknown>;
  messages: unknown[];
  last_active: string;
}

export async function getConversationByPhone(
  phone: string,
  db: Queryable = getPool(),
): Promise<ConversationRow | null> {
  return await queryOne<ConversationRow>(
    `select * from conversations where phone = $1`,
    [phone],
    db,
  );
}

/**
 * Upsert por clave primaria `phone`. `context` y `messages` van serializados a
 * mano porque `pg` convertiría un array JS en un array de Postgres, no en JSONB.
 */
export async function upsertConversation(
  values: ConversationUpsert,
  db: Queryable = getPool(),
): Promise<void> {
  await query(
    `insert into conversations (phone, state, context, messages, last_active)
     values ($1, $2, $3::jsonb, $4::jsonb, $5)
     on conflict (phone) do update set
       state = excluded.state,
       context = excluded.context,
       messages = excluded.messages,
       last_active = excluded.last_active`,
    [values.phone, values.state, json(values.context), json(values.messages), values.last_active],
    db,
  );
}
