import { describe, expect, it } from "vitest";
import { buildInsert, buildSet, json, query, queryExactlyOne, queryOne } from "@/lib/bot/db";
import { mockDb } from "./helpers/mockDb";

describe("buildInsert", () => {
  it("ignora undefined y conserva null", () => {
    const built = buildInsert({ a: 1, b: undefined, c: null });
    expect(built.columns).toBe("a, c");
    expect(built.placeholders).toBe("$1, $2");
    expect(built.params).toEqual([1, null]);
  });

  it("falla si no queda ninguna columna", () => {
    expect(() => buildInsert({ a: undefined })).toThrow(/no columns to insert/);
  });
});

describe("buildSet", () => {
  it("numera desde 1 por defecto", () => {
    const built = buildSet({ a: 1, b: null, c: undefined });
    expect(built.assignments).toBe("a = $1, b = $2");
    expect(built.params).toEqual([1, null]);
  });

  it("respeta el desplazamiento de placeholders", () => {
    expect(buildSet({ a: 1 }, 3).assignments).toBe("a = $3");
  });

  it("falla si no hay nada que actualizar", () => {
    expect(() => buildSet({ a: undefined })).toThrow(/no columns to update/);
  });
});

describe("json", () => {
  it("serializa objetos y arrays, y convierte undefined en null", () => {
    expect(json({ a: 1 })).toBe('{"a":1}');
    expect(json([1, 2])).toBe("[1,2]");
    expect(json(undefined)).toBe("null");
  });
});

describe("helpers de consulta", () => {
  it("query normaliza los Date a cadena ISO", async () => {
    const db = mockDb([{ created_at: new Date("2026-09-08T10:00:00.000Z"), n: 1 }]);
    const rows = await query<{ created_at: string; n: number }>("select 1", [], db);
    expect(rows[0].created_at).toBe("2026-09-08T10:00:00.000Z");
    expect(rows[0].n).toBe(1);
  });

  it("queryOne devuelve null sin filas", async () => {
    expect(await queryOne("select 1", [], mockDb([]))).toBeNull();
  });

  it("queryExactlyOne lanza sin filas", async () => {
    await expect(queryExactlyOne("select 1", [], mockDb([]))).rejects.toThrow(
      /exactly one row/i,
    );
  });
});
