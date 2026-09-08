import { describe, expect, it } from "vitest";
import { getConfigValue, upsertConfigValue } from "@/lib/bot/repo/config";
import { mockDb } from "../helpers/mockDb";

describe("getConfigValue", () => {
  it("devuelve el JSONB ya parseado", async () => {
    const db = mockDb([{ value: { timezone: "Europe/Madrid" } }]);
    const value = await getConfigValue<{ timezone: string }>("schedule", db);

    expect(db.lastSql()).toBe("select value from config where key = $1");
    expect(db.lastValues()).toEqual(["schedule"]);
    expect(value).toEqual({ timezone: "Europe/Madrid" });
  });

  it("devuelve null si la clave no existe (el horario cae al por defecto)", async () => {
    const db = mockDb([]);
    expect(await getConfigValue("schedule", db)).toBeNull();
  });
});

describe("upsertConfigValue", () => {
  it("hace upsert por la clave primaria y serializa el valor", async () => {
    const db = mockDb();
    await upsertConfigValue("schedule", { slot_minutes: 30 }, "2026-09-08T10:00:00.000Z", db);

    expect(db.lastSql()).toBe(
      "insert into config (key, value, updated_at) values ($1, $2::jsonb, $3) " +
        "on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at",
    );
    expect(db.lastValues()).toEqual([
      "schedule",
      '{"slot_minutes":30}',
      "2026-09-08T10:00:00.000Z",
    ]);
  });
});
