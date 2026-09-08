import type { Queryable } from "@/lib/bot/db";

export interface RecordedCall {
  text: string;
  values: unknown[];
}

export interface MockDb extends Queryable {
  calls: RecordedCall[];
  /** SQL de la última consulta con los espacios colapsados. */
  lastSql(): string;
  lastValues(): unknown[];
}

/**
 * Doble de test de un cliente `pg`: registra el SQL y los parámetros recibidos
 * y devuelve las filas que se le indiquen.
 */
export function mockDb(rows: Record<string, unknown>[] = []): MockDb {
  const calls: RecordedCall[] = [];
  return {
    calls,
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      return { rows, rowCount: rows.length };
    },
    lastSql() {
      return squash(calls[calls.length - 1]?.text ?? "");
    },
    lastValues() {
      return calls[calls.length - 1]?.values ?? [];
    },
  };
}

/** Colapsa saltos de línea e indentación para poder comparar SQL literal. */
export function squash(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}
