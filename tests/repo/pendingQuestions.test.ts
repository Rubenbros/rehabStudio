import { describe, expect, it } from "vitest";
import {
  getPendingQuestionById,
  insertPendingQuestion,
  listOpenQuestionSummaries,
  listOpenQuestions,
  updatePendingQuestion,
} from "@/lib/bot/repo/pendingQuestions";
import { mockDb } from "../helpers/mockDb";

describe("insertPendingQuestion", () => {
  it("inserta la pregunta y devuelve la fila con su id", async () => {
    const db = mockDb([{ id: "q1" }]);
    const row = await insertPendingQuestion(
      {
        patient_phone: "+34600000001",
        patient_name: "Ana",
        question: "¿Puedo entrenar?",
        notified_owner_at: "2026-09-08T10:00:00.000Z",
      },
      db,
    );

    expect(db.lastSql()).toBe(
      "insert into pending_questions (patient_phone, patient_name, question, notified_owner_at) " +
        "values ($1, $2, $3, $4) returning *",
    );
    expect(row.id).toBe("q1");
  });
});

describe("updatePendingQuestion", () => {
  it("marca la pregunta como respondida", async () => {
    const db = mockDb();
    await updatePendingQuestion(
      "q1",
      { status: "answered", answer: "Sí", answered_at: "2026-09-08T11:00:00.000Z" },
      db,
    );

    expect(db.lastSql()).toBe(
      "update pending_questions set status = $1, answer = $2, answered_at = $3 where id = $4",
    );
    expect(db.lastValues()).toEqual([
      "answered",
      "Sí",
      "2026-09-08T11:00:00.000Z",
      "q1",
    ]);
  });
});

describe("listados de preguntas abiertas", () => {
  it("lista completa, la más antigua primero", async () => {
    const db = mockDb();
    await listOpenQuestions(db);
    expect(db.lastSql()).toBe(
      "select * from pending_questions where status = $1 order by asked_at asc",
    );
    expect(db.lastValues()).toEqual(["pending"]);
  });

  it("proyección para el prompt del owner", async () => {
    const db = mockDb();
    await listOpenQuestionSummaries(db);
    expect(db.lastSql()).toBe(
      "select id, patient_name, patient_phone, question, asked_at " +
        "from pending_questions where status = $1 order by asked_at asc",
    );
  });
});

describe("getPendingQuestionById", () => {
  it("devuelve null cuando no existe", async () => {
    const db = mockDb([]);
    expect(await getPendingQuestionById("nope", db)).toBeNull();
    expect(db.lastSql()).toBe("select * from pending_questions where id = $1");
  });
});
