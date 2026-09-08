import { describe, expect, it } from "vitest";
import {
  getConversationByPhone,
  upsertConversation,
} from "@/lib/bot/repo/conversations";
import { mockDb } from "../helpers/mockDb";

describe("getConversationByPhone", () => {
  it("consulta por la clave primaria", async () => {
    const db = mockDb([{ phone: "+34600000001", state: "idle" }]);
    const row = await getConversationByPhone("+34600000001", db);

    expect(db.lastSql()).toBe("select * from conversations where phone = $1");
    expect(row?.state).toBe("idle");
  });
});

describe("upsertConversation", () => {
  it("serializa context y messages como JSONB, no como array de Postgres", async () => {
    const db = mockDb();
    await upsertConversation(
      {
        phone: "+34600000001",
        state: "booking",
        context: { step: 2 },
        messages: [{ role: "user", content: "hola" }],
        last_active: "2026-09-08T10:00:00.000Z",
      },
      db,
    );

    const sql = db.lastSql();
    expect(sql).toContain("insert into conversations (phone, state, context, messages, last_active)");
    expect(sql).toContain("values ($1, $2, $3::jsonb, $4::jsonb, $5)");
    expect(sql).toContain("on conflict (phone) do update set");
    expect(sql).toContain("messages = excluded.messages");

    expect(db.lastValues()[2]).toBe('{"step":2}');
    expect(db.lastValues()[3]).toBe('[{"role":"user","content":"hola"}]');
  });
});
