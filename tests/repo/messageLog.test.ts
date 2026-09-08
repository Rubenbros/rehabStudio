import { describe, expect, it } from "vitest";
import { countInboundSince, insertMessage } from "@/lib/bot/repo/messageLog";
import { mockDb } from "../helpers/mockDb";

describe("insertMessage", () => {
  it("sin meta deja actuar al DEFAULT de la columna", async () => {
    const db = mockDb();
    await insertMessage({ phone: "+34600000001", direction: "inbound", body: "hola" }, db);

    expect(db.lastSql()).toBe(
      "insert into message_log (phone, direction, body) values ($1, $2, $3)",
    );
    expect(db.lastValues()).toEqual(["+34600000001", "inbound", "hola"]);
  });

  it("serializa meta a JSONB en lugar de dejar que pg lo trate como array", async () => {
    const db = mockDb();
    await insertMessage(
      { phone: "+34600000001", direction: "outbound", body: "ok", meta: { sid: "SM1" } },
      db,
    );

    expect(db.lastSql()).toBe(
      "insert into message_log (phone, direction, body, meta) values ($1, $2, $3, $4::jsonb)",
    );
    expect(db.lastValues()[3]).toBe('{"sid":"SM1"}');
  });
});

describe("countInboundSince (rate limit)", () => {
  it("cuenta solo los entrantes del teléfono desde el corte", async () => {
    const db = mockDb([{ count: 3 }]);
    const n = await countInboundSince("+34600000001", "2026-09-08T10:00:00.000Z", db);

    expect(db.lastSql()).toBe(
      "select count(*)::int as count from message_log " +
        "where phone = $1 and direction = $2 and created_at >= $3",
    );
    expect(db.lastValues()).toEqual([
      "+34600000001",
      "inbound",
      "2026-09-08T10:00:00.000Z",
    ]);
    expect(n).toBe(3);
  });

  it("devuelve un número aunque pg entregue el count como cadena", async () => {
    const db = mockDb([{ count: "7" }]);
    expect(await countInboundSince("+34600000001", "X", db)).toBe(7);
  });

  it("devuelve 0 si no hay filas", async () => {
    const db = mockDb([]);
    expect(await countInboundSince("+34600000001", "X", db)).toBe(0);
  });
});
