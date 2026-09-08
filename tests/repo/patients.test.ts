import { describe, expect, it } from "vitest";
import {
  getPatientByPhone,
  insertPatient,
  upsertPatientByPhone,
} from "@/lib/bot/repo/patients";
import { mockDb } from "../helpers/mockDb";

describe("getPatientByPhone", () => {
  it("busca por teléfono y devuelve null si no existe", async () => {
    const db = mockDb([]);
    expect(await getPatientByPhone("+34600000001", db)).toBeNull();
    expect(db.lastSql()).toBe("select * from patients where phone = $1");
    expect(db.lastValues()).toEqual(["+34600000001"]);
  });
});

describe("insertPatient", () => {
  it("inserta solo lo aportado y devuelve la fila", async () => {
    const db = mockDb([{ id: "p1" }]);
    const row = await insertPatient({ phone: "+34600000001", language: "en", is_owner: false }, db);

    expect(db.lastSql()).toBe(
      "insert into patients (phone, language, is_owner) values ($1, $2, $3) returning *",
    );
    expect(db.lastValues()).toEqual(["+34600000001", "en", false]);
    expect(row.id).toBe("p1");
  });
});

describe("upsertPatientByPhone", () => {
  it("no pisa las columnas ausentes (update_patient parcial)", async () => {
    const db = mockDb();
    await upsertPatientByPhone(
      {
        phone: "+34600000001",
        full_name: undefined,
        email: "a@b.com",
        reason: undefined,
        language: "es",
        updated_at: "2026-09-08T10:00:00.000Z",
      },
      db,
    );

    expect(db.lastSql()).toBe(
      "insert into patients (phone, email, language, updated_at) values ($1, $2, $3, $4) " +
        "on conflict (phone) do update set email = excluded.email, " +
        "language = excluded.language, updated_at = excluded.updated_at",
    );
    expect(db.lastValues()).toEqual([
      "+34600000001",
      "a@b.com",
      "es",
      "2026-09-08T10:00:00.000Z",
    ]);
  });

  it("nunca reasigna la columna de conflicto", async () => {
    const db = mockDb();
    await upsertPatientByPhone({ phone: "+34600000001", full_name: "Ana" }, db);

    expect(db.lastSql()).toBe(
      "insert into patients (phone, full_name) values ($1, $2) " +
        "on conflict (phone) do update set full_name = excluded.full_name",
    );
  });

  it("con solo el teléfono no intenta actualizar nada", async () => {
    const db = mockDb();
    await upsertPatientByPhone({ phone: "+34600000001" }, db);
    expect(db.lastSql()).toBe(
      "insert into patients (phone) values ($1) on conflict (phone) do nothing",
    );
  });
});
