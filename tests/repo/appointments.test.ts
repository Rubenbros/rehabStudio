import { describe, expect, it } from "vitest";
import {
  getAppointmentById,
  insertAppointment,
  listAppointmentStats,
  listAppointments,
  listConfirmedNeedingFollowup,
  listConfirmedNeedingReminder,
  listPendingApprovalSummaries,
  listPendingApprovals,
  listStalePendingApprovals,
  updateAppointment,
} from "@/lib/bot/repo/appointments";
import { mockDb } from "../helpers/mockDb";

const BASE = {
  patient_phone: "+34600000001",
  starts_at: "2026-09-10T08:00:00.000Z",
  ends_at: "2026-09-10T09:00:00.000Z",
  duration_min: 60,
  price_eur: 60,
};

describe("insertAppointment", () => {
  it("omite las columnas con valor undefined y devuelve la fila insertada", async () => {
    const db = mockDb([{ id: "appt-1" }]);
    const row = await insertAppointment({ ...BASE, notes: undefined, status: "confirmed" }, db);

    expect(db.lastSql()).toBe(
      "insert into appointments (patient_phone, starts_at, ends_at, duration_min, price_eur, status) " +
        "values ($1, $2, $3, $4, $5, $6) returning *",
    );
    expect(db.lastValues()).toEqual([
      BASE.patient_phone,
      BASE.starts_at,
      BASE.ends_at,
      60,
      60,
      "confirmed",
    ]);
    expect(row.id).toBe("appt-1");
  });

  it("sí escribe los null explícitos", async () => {
    const db = mockDb([{ id: "appt-2" }]);
    await insertAppointment({ ...BASE, patient_id: null }, db);

    expect(db.lastSql()).toBe(
      "insert into appointments (patient_phone, starts_at, ends_at, duration_min, price_eur, patient_id) " +
        "values ($1, $2, $3, $4, $5, $6) returning *",
    );
    expect(db.lastValues()[5]).toBeNull();
  });

  it("falla si la sentencia no devuelve fila", async () => {
    const db = mockDb([]);
    await expect(insertAppointment(BASE, db)).rejects.toThrow(/exactly one row/i);
  });
});

describe("updateAppointment", () => {
  it("solo asigna las columnas presentes y pone el id al final", async () => {
    const db = mockDb();
    await updateAppointment(
      "appt-1",
      { starts_at: "2026-09-11T08:00:00.000Z", reminder_24h_sent_at: null, notes: undefined },
      db,
    );

    expect(db.lastSql()).toBe(
      "update appointments set starts_at = $1, reminder_24h_sent_at = $2 where id = $3",
    );
    expect(db.lastValues()).toEqual(["2026-09-11T08:00:00.000Z", null, "appt-1"]);
  });
});

describe("listAppointments", () => {
  it("por defecto excluye canceladas y pendientes de aprobación", async () => {
    const db = mockDb();
    await listAppointments({ from: "A", to: "B" }, db);

    expect(db.lastSql()).toBe(
      "select * from appointments where starts_at >= $1 and starts_at <= $2 and status <> $3 " +
        "and status <> $4 order by starts_at asc",
    );
    expect(db.lastValues()).toEqual(["A", "B", "cancelled", "pending_approval"]);
  });

  it("con include_pending mantiene las pendientes", async () => {
    const db = mockDb();
    await listAppointments({ from: "A", to: "B", includePending: true }, db);

    expect(db.lastSql()).toBe(
      "select * from appointments where starts_at >= $1 and starts_at <= $2 and status <> $3 " +
        "order by starts_at asc",
    );
    expect(db.lastValues()).toEqual(["A", "B", "cancelled"]);
  });

  it("filtra por teléfono numerando bien el placeholder", async () => {
    const db = mockDb();
    await listAppointments({ from: "A", to: "B", patientPhone: "+34600000001" }, db);

    expect(db.lastSql()).toContain("and patient_phone = $5");
    expect(db.lastValues()).toEqual(["A", "B", "cancelled", "pending_approval", "+34600000001"]);
  });
});

describe("consultas de aprobaciones pendientes", () => {
  it("lista completa ordenada por antigüedad", async () => {
    const db = mockDb();
    await listPendingApprovals(db);
    expect(db.lastSql()).toBe(
      "select * from appointments where status = $1 order by created_at asc",
    );
    expect(db.lastValues()).toEqual(["pending_approval"]);
  });

  it("proyección para el prompt del owner", async () => {
    const db = mockDb();
    await listPendingApprovalSummaries(db);
    expect(db.lastSql()).toBe(
      "select id, patient_name, patient_phone, starts_at, duration_min, created_at " +
        "from appointments where status = $1 order by created_at asc",
    );
  });
});

describe("listAppointmentStats", () => {
  it("proyecta solo las cuatro columnas del cálculo", async () => {
    const db = mockDb();
    await listAppointmentStats({ from: "A", to: "B" }, db);
    expect(db.lastSql()).toBe(
      "select duration_min, price_eur, status, kind from appointments " +
        "where starts_at >= $1 and starts_at <= $2",
    );
    expect(db.lastValues()).toEqual(["A", "B"]);
  });
});

describe("joins del cron con patients(language)", () => {
  it("recordatorio del día anterior: rango semiabierto y marca sin enviar", async () => {
    const db = mockDb();
    await listConfirmedNeedingReminder({ from: "A", to: "B" }, db);

    const sql = db.lastSql();
    expect(sql).toContain("left join patients p on p.id = a.patient_id");
    expect(sql).toContain("jsonb_build_object('language', p.language)");
    expect(sql).toContain("a.starts_at >= $1 and a.starts_at < $2");
    expect(sql).toContain("a.reminder_24h_sent_at is null");
    expect(db.lastValues()).toEqual(["A", "B", "confirmed"]);
  });

  it("seguimiento D+10: rango cerrado sobre ends_at", async () => {
    const db = mockDb();
    await listConfirmedNeedingFollowup({ from: "A", to: "B" }, db);

    const sql = db.lastSql();
    expect(sql).toContain("a.ends_at >= $1 and a.ends_at <= $2");
    expect(sql).toContain("a.followup_sent_at is null");
    expect(db.lastValues()).toEqual(["A", "B", "confirmed"]);
  });

  it("auto-rechazo: pendientes creadas antes del corte", async () => {
    const db = mockDb();
    await listStalePendingApprovals("2026-09-08T10:00:00.000Z", db);

    expect(db.lastSql()).toContain("a.status = $1 and a.created_at <= $2");
    expect(db.lastValues()).toEqual(["pending_approval", "2026-09-08T10:00:00.000Z"]);
  });

  it("devuelve patients a null cuando la cita no tiene paciente asociado", async () => {
    const db = mockDb([{ id: "appt-1", patients: null }]);
    const rows = await listStalePendingApprovals("X", db);
    expect(rows[0].patients).toBeNull();
  });
});

describe("getAppointmentById", () => {
  it("devuelve null si no hay fila", async () => {
    const db = mockDb([]);
    expect(await getAppointmentById("missing", db)).toBeNull();
    expect(db.lastSql()).toBe("select * from appointments where id = $1");
  });

  it("convierte los Date de pg en cadenas ISO", async () => {
    const db = mockDb([{ id: "appt-1", starts_at: new Date("2026-09-10T08:00:00.000Z") }]);
    const row = await getAppointmentById("appt-1", db);
    expect(row?.starts_at).toBe("2026-09-10T08:00:00.000Z");
  });
});
