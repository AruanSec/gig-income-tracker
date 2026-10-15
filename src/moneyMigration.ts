import type Database from "better-sqlite3";
import type { PoolClient } from "pg";
import { FinancialDecimal, MAX_MONEY } from "./money";

export const MONEY_COLUMNS: Record<string, string[]> = {
  income_entries: ["netFare", "tips", "taxes", "totalEarnings"],
  vehicle_expenses: ["amount", "gstHstAmount"],
};

function canonical(value: unknown): string {
  const decimal = new FinancialDecimal(value == null ? 0 : String(value));
  if (!decimal.isFinite() || decimal.abs().greaterThan(MAX_MONEY * 2)) {
    throw new Error("Money migration stopped: an existing amount is outside the supported CAD range.");
  }
  return decimal.toFixed(2);
}

/** Preserve IDs, ownership, notes and every non-money column; commit both tables together. */
export function migrateSqliteMoney(db: Database.Database): void {
  db.transaction(() => {
    db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)");
    if (db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get("exact-money-v1")) return;
    for (const [table, columns] of Object.entries(MONEY_COLUMNS)) {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string };
      const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL").all(table) as { sql: string }[];
      let create = schema.sql.replace(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?["\\x60]?${table}["\\x60]?`, "i"), `CREATE TABLE ${table}_decimal`);
      for (const column of columns) create = create.replace(new RegExp(`("?${column}"?\\s+)(?:REAL|DOUBLE PRECISION|NUMERIC(?:\\([^)]*\\))?|TEXT)`, "i"), "$1TEXT");
      db.exec(create);
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      for (const row of rows) {
        for (const column of columns) row[column] = canonical(row[column]);
        if (table === "income_entries") row.totalEarnings = canonical(new FinancialDecimal(String(row.netFare)).plus(String(row.tips)).minus(String(row.taxes)).toString());
        const names = Object.keys(row);
        db.prepare(`INSERT INTO ${table}_decimal (${names.map(name => `"${name}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(...Object.values(row));
      }
      db.exec(`DROP TABLE ${table}; ALTER TABLE ${table}_decimal RENAME TO ${table}`);
      for (const index of indexes) db.exec(index.sql);
    }
    db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run("exact-money-v1");
  })();
}

export async function migratePostgresMoney(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(71920461)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)");
    if (!(await client.query("SELECT version FROM schema_migrations WHERE version = $1", ["exact-money-v1"])).rows.length) {
      for (const [table, columns] of Object.entries(MONEY_COLUMNS)) {
        await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
        const rows = (await client.query(`SELECT ${columns.map(column => `"${column}"`).join(",")} FROM ${table}`)).rows;
        for (const row of rows) for (const column of columns) canonical(row[column]);
        for (const column of columns) await client.query(`ALTER TABLE ${table} ALTER COLUMN "${column}" TYPE NUMERIC(15,2) USING ROUND(COALESCE("${column}", 0)::numeric, 2)`);
      }
      await client.query('UPDATE income_entries SET "totalEarnings" = "netFare" + tips - taxes');
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["exact-money-v1"]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

// Public API remains numeric CAD; persistence uses decimal values rather than binary floats.
export function decodeMoneyRows<T>(rows: T[]): T[] {
  const columns = new Set(Object.values(MONEY_COLUMNS).flat());
  return rows.map(row => {
    const result = { ...row };
    for (const key of Object.keys(result)) if (columns.has(key) && result[key] != null) result[key] = Number(result[key]);
    return result;
  });
}
