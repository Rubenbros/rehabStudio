import {
  buildInsert,
  buildSet,
  getPool,
  query,
  queryExactlyOne,
  queryOne,
  type Queryable,
} from "../db";
import type { PendingQuestionRow } from "./types";

export interface PendingQuestionInsert {
  patient_phone: string;
  patient_name?: string | null;
  question: string;
  status?: string;
  notified_owner_at?: string | null;
}

export interface PendingQuestionPatch {
  status?: string;
  answer?: string | null;
  answered_at?: string | null;
}

/** Proyección que el orquestador inyecta en el prompt del owner. */
export type OpenQuestionRow = Pick<
  PendingQuestionRow,
  "id" | "patient_name" | "patient_phone" | "question" | "asked_at"
>;

export async function insertPendingQuestion(
  values: PendingQuestionInsert,
  db: Queryable = getPool(),
): Promise<PendingQuestionRow> {
  const { columns, placeholders, params } = buildInsert(values);
  return await queryExactlyOne<PendingQuestionRow>(
    `insert into pending_questions (${columns}) values (${placeholders}) returning *`,
    params,
    db,
  );
}

export async function getPendingQuestionById(
  id: string,
  db: Queryable = getPool(),
): Promise<PendingQuestionRow | null> {
  return await queryOne<PendingQuestionRow>(
    `select * from pending_questions where id = $1`,
    [id],
    db,
  );
}

export async function updatePendingQuestion(
  id: string,
  patch: PendingQuestionPatch,
  db: Queryable = getPool(),
): Promise<void> {
  const { assignments, params } = buildSet(patch);
  await query(
    `update pending_questions set ${assignments} where id = $${params.length + 1}`,
    [...params, id],
    db,
  );
}

/** Preguntas sin responder, la más antigua primero. */
export async function listOpenQuestions(
  db: Queryable = getPool(),
): Promise<PendingQuestionRow[]> {
  return await query<PendingQuestionRow>(
    `select * from pending_questions where status = $1 order by asked_at asc`,
    ["pending"],
    db,
  );
}

/** Igual que `listOpenQuestions` pero solo con lo que va al prompt. */
export async function listOpenQuestionSummaries(
  db: Queryable = getPool(),
): Promise<OpenQuestionRow[]> {
  return await query<OpenQuestionRow>(
    `select id, patient_name, patient_phone, question, asked_at
       from pending_questions
      where status = $1
      order by asked_at asc`,
    ["pending"],
    db,
  );
}
