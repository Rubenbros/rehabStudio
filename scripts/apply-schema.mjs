#!/usr/bin/env node
/**
 * Aplica `db/schema.sql` a la base de datos de `DATABASE_URL`.
 * Idempotente (todo el DDL es `create ... if not exists`) y sin depender de psql.
 *
 *   npm run db:schema
 *   node --env-file=.env.local scripts/apply-schema.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "..", "db", "schema.sql");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL. Ejemplo local (Cloud SQL Auth Proxy):");
  console.error("  postgresql://rehab_app:***@127.0.0.1:5433/rehab");
  process.exit(1);
}

// `SET` no admite parámetros, así que el nombre del esquema se valida a mano.
const schema = process.env.DB_SCHEMA ?? "public";
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  console.error(`DB_SCHEMA no es un identificador válido: ${schema}`);
  process.exit(1);
}

const sql = await readFile(schemaPath, "utf8");
const client = new pg.Client({ connectionString });

await client.connect();
try {
  await client.query("begin");
  // El DDL va sin cualificar para poder reutilizarlo en esquemas de test.
  await client.query(`set local search_path to ${schema}`);
  await client.query(sql);
  await client.query("commit");
  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = $1 order by table_name`,
    [schema],
  );
  console.log(
    `Esquema aplicado. Tablas en ${schema}: ${rows.map((r) => r.table_name).join(", ")}`,
  );
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error("Error aplicando el esquema:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
