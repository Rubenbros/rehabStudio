import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  insertAppointment,
  listAppointments,
  listPendingApprovals,
  listStalePendingApprovals,
  updateAppointment,
} from "@/lib/bot/repo/appointments";
import { getConfigValue, upsertConfigValue } from "@/lib/bot/repo/config";
import { getConversationByPhone, upsertConversation } from "@/lib/bot/repo/conversations";
import { countInboundSince, insertMessage } from "@/lib/bot/repo/messageLog";
import { getPatientByPhone, insertPatient, upsertPatientByPhone } from "@/lib/bot/repo/patients";
import {
  getPendingQuestionById,
  insertPendingQuestion,
  listOpenQuestions,
  updatePendingQuestion,
} from "@/lib/bot/repo/pendingQuestions";

/**
 * Test de integración contra PostgreSQL real. Solo se ejecuta si existe
 * `DATABASE_URL_TEST` (en local, la base `rehab` a través del Cloud SQL Auth
 * Proxy en 127.0.0.1:5433).
 *
 * La instancia de Cloud SQL está compartida entre varias apps, así que el test
 * NO escribe en `public`: crea un esquema desechable, aplica ahí `db/schema.sql`
 * y hace que el pool lo use vía `search_path` en la cadena de conexión. Al
 * terminar lo borra entero, de modo que ni un fallo a mitad deja basura en los
 * datos reales.
 */
const connectionString = process.env.DATABASE_URL_TEST;
const SCHEMA = `rehab_test_${process.pid}`;

/**
 * El espacio va como %20 a propósito: `URLSearchParams` lo codificaría como `+`
 * y `pg-connection-string` no lo traduce, con lo que el parámetro se ignoraría
 * en silencio y el test acabaría escribiendo en `public`.
 */
function withSearchPath(url: string, schema: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}options=-c%20search_path%3D${schema}`;
}

describe.skipIf(!connectionString)("capa de repositorio contra PostgreSQL real", () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const phone = `+34999${suffix}`;
  const orphanPhone = `${phone}X`;

  let admin: Pool;
  let pool: Pool;
  let patientId: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString, max: 1 });
    await admin.query(`drop schema if exists ${SCHEMA} cascade`);
    await admin.query(`create schema ${SCHEMA}`);

    const ddl = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
    const client = await admin.connect();
    try {
      await client.query(`set search_path to ${SCHEMA}`);
      await client.query(ddl);
    } finally {
      client.release();
    }

    pool = new Pool({ connectionString: withSearchPath(connectionString!, SCHEMA), max: 2 });
  });

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`drop schema if exists ${SCHEMA} cascade`);
      await admin.end();
    }
  });

  it("el pool apunta al esquema desechable, no a public", async () => {
    const { rows } = await pool.query("select current_schema() as schema");
    expect(rows[0].schema).toBe(SCHEMA);
  });

  it("inserta y recupera un paciente", async () => {
    const created = await insertPatient({ phone, language: "en", is_owner: false }, pool);
    patientId = created.id;

    expect(created.phone).toBe(phone);
    expect(created.language).toBe("en");
    expect(created.is_owner).toBe(false);
    // timestamptz normalizado a cadena ISO.
    expect(created.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const fetched = await getPatientByPhone(phone, pool);
    expect(fetched?.id).toBe(patientId);
  });

  it("el upsert parcial no borra las columnas ausentes", async () => {
    await upsertPatientByPhone(
      { phone, full_name: "Ana Test", language: "es", updated_at: new Date().toISOString() },
      pool,
    );
    await upsertPatientByPhone(
      { phone, email: "ana@example.com", language: "es", updated_at: new Date().toISOString() },
      pool,
    );

    const row = await getPatientByPhone(phone, pool);
    expect(row?.full_name).toBe("Ana Test");
    expect(row?.email).toBe("ana@example.com");
  });

  it("inserta una cita pendiente y la encuentra en los listados", async () => {
    const startsAt = new Date(Date.now() + 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);

    const appt = await insertAppointment(
      {
        patient_id: patientId,
        patient_phone: phone,
        patient_name: "Ana Test",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_min: 60,
        price_eur: 60,
        kind: "session",
        status: "pending_approval",
        notes: undefined,
      },
      pool,
    );

    expect(appt.status).toBe("pending_approval");
    expect(appt.notes).toBeNull();
    expect(appt.google_event_id).toBeNull();

    const pending = await listPendingApprovals(pool);
    expect(pending.some((r) => r.id === appt.id)).toBe(true);

    // Por defecto `list_appointments` esconde las pendientes.
    const range = {
      from: new Date(Date.now() - 86_400_000).toISOString(),
      to: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      patientPhone: phone,
    };
    expect((await listAppointments(range, pool)).some((r) => r.id === appt.id)).toBe(false);
    expect(
      (await listAppointments({ ...range, includePending: true }, pool)).some(
        (r) => r.id === appt.id,
      ),
    ).toBe(true);
  });

  it("el join del cron trae el idioma del paciente, y null si no hay paciente", async () => {
    const orphan = await insertAppointment(
      {
        patient_phone: orphanPhone,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3_600_000).toISOString(),
        duration_min: 30,
        price_eur: 30,
        status: "pending_approval",
      },
      pool,
    );

    const stale = await listStalePendingApprovals(
      new Date(Date.now() + 60_000).toISOString(),
      pool,
    );

    const withPatient = stale.find((r) => r.patient_phone === phone);
    const withoutPatient = stale.find((r) => r.id === orphan.id);

    expect(withPatient?.patients).toEqual({ language: "es" });
    expect(withoutPatient?.patients).toBeNull();
  });

  it("update escribe los null explícitos y respeta lo omitido", async () => {
    const pending = await listPendingApprovals(pool);
    const mine = pending.find((r) => r.patient_phone === phone);
    expect(mine).toBeDefined();

    await updateAppointment(
      mine!.id,
      { status: "confirmed", reminder_24h_sent_at: null, notes: undefined },
      pool,
    );

    const { rows } = await pool.query(`select * from appointments where id = $1`, [mine!.id]);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].reminder_24h_sent_at).toBeNull();
  });

  it("cuenta los mensajes entrantes para el rate limit", async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    expect(await countInboundSince(phone, since, pool)).toBe(0);

    await insertMessage({ phone, direction: "inbound", body: "hola" }, pool);
    await insertMessage({ phone, direction: "inbound", body: "otra" }, pool);
    await insertMessage(
      { phone, direction: "outbound", body: "respuesta", meta: { sid: "SM1" } },
      pool,
    );

    expect(await countInboundSince(phone, since, pool)).toBe(2);

    const { rows } = await pool.query(
      `select meta from message_log where phone = $1 and direction = 'outbound'`,
      [phone],
    );
    expect(rows[0].meta).toEqual({ sid: "SM1" });
  });

  it("guarda y recupera la conversación con su JSONB", async () => {
    const messages = [{ role: "user", content: "hola" }];
    await upsertConversation(
      {
        phone,
        state: "booking",
        context: { step: 2 },
        messages,
        last_active: new Date().toISOString(),
      },
      pool,
    );

    let row = await getConversationByPhone(phone, pool);
    expect(row?.state).toBe("booking");
    expect(row?.context).toEqual({ step: 2 });
    expect(row?.messages).toEqual(messages);

    await upsertConversation(
      {
        phone,
        state: "idle",
        context: {},
        messages: [],
        last_active: new Date().toISOString(),
      },
      pool,
    );
    row = await getConversationByPhone(phone, pool);
    expect(row?.state).toBe("idle");
    expect(row?.messages).toEqual([]);
  });

  it("recorre el ciclo de una pregunta pendiente", async () => {
    const q = await insertPendingQuestion(
      {
        patient_phone: phone,
        patient_name: "Ana Test",
        question: "¿Puedo entrenar?",
        notified_owner_at: new Date().toISOString(),
      },
      pool,
    );
    expect(q.status).toBe("pending");

    const open = await listOpenQuestions(pool);
    expect(open.some((r) => r.id === q.id)).toBe(true);

    await updatePendingQuestion(
      q.id,
      { status: "answered", answer: "Sí, con cuidado", answered_at: new Date().toISOString() },
      pool,
    );

    const after = await getPendingQuestionById(q.id, pool);
    expect(after?.status).toBe("answered");
    expect(after?.answer).toBe("Sí, con cuidado");
  });

  it("guarda y relee el horario en config", async () => {
    expect(await getConfigValue("schedule", pool)).toBeNull();

    const schedule = { timezone: "Europe/Madrid", slot_minutes: 30, days: { mon: [] } };
    await upsertConfigValue("schedule", schedule, new Date().toISOString(), pool);
    expect(await getConfigValue("schedule", pool)).toEqual(schedule);

    const updated = { ...schedule, slot_minutes: 60 };
    await upsertConfigValue("schedule", updated, new Date().toISOString(), pool);
    expect(await getConfigValue("schedule", pool)).toEqual(updated);
  });
});
