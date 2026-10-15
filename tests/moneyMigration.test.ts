import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import pg from "pg";
import { migrateSqliteMoney, migratePostgresMoney } from "../src/moneyMigration";

function fixture(db: Database.Database, invalid = false) {
  db.exec(`CREATE TABLE income_entries (id TEXT PRIMARY KEY, user_id TEXT, notes TEXT, netFare REAL, tips REAL, taxes REAL, totalEarnings REAL);
    CREATE INDEX income_fixture_idx ON income_entries(user_id);
    CREATE TABLE vehicle_expenses (id TEXT PRIMARY KEY, amount REAL, gstHstAmount REAL);
    INSERT INTO income_entries VALUES ('income', 'owner', 'preserve me', 1.005, 0.2, 0.1, 999);
    INSERT INTO vehicle_expenses VALUES ('expense', ${invalid ? '1e20' : '2.675'}, 0.005);`);
}

test("SQLite migration preserves records, rounds cents, recomputes earnings and is idempotent", () => {
  const db = new Database(":memory:");
  try {
    fixture(db); migrateSqliteMoney(db);
    assert.deepEqual(db.prepare("SELECT * FROM income_entries").get(), { id: "income", user_id: "owner", notes: "preserve me", netFare: "1.01", tips: "0.20", taxes: "0.10", totalEarnings: "1.11" });
    assert.deepEqual(db.prepare("SELECT * FROM vehicle_expenses").get(), { id: "expense", amount: "2.68", gstHstAmount: "0.01" });
    assert.equal((db.prepare("SELECT type FROM pragma_table_info('income_entries') WHERE name = 'netFare'").get() as any).type, "TEXT");
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'income_fixture_idx'").get());
    migrateSqliteMoney(db);
    assert.equal((db.prepare("SELECT count(*) AS count FROM schema_migrations").get() as any).count, 1);
  } finally { db.close(); }
});

test("SQLite migration rolls both tables back when a legacy amount cannot be migrated", () => {
  const db = new Database(":memory:");
  try {
    fixture(db, true);
    assert.throws(() => migrateSqliteMoney(db), /migration stopped/);
    assert.equal((db.prepare("SELECT netFare FROM income_entries").get() as any).netFare, 1.005);
    assert.equal((db.prepare("SELECT type FROM pragma_table_info('income_entries') WHERE name = 'netFare'").get() as any).type, "REAL");
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%_decimal'").all().length, 0);
  } finally { db.close(); }
});

test("PostgreSQL decimal migration preserves records and rolls back failures", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  const schema = `money_test_${Date.now()}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE income_entries (id TEXT PRIMARY KEY, "netFare" DOUBLE PRECISION, tips DOUBLE PRECISION, taxes DOUBLE PRECISION, "totalEarnings" DOUBLE PRECISION);
      CREATE TABLE vehicle_expenses (id TEXT PRIMARY KEY, amount DOUBLE PRECISION, "gstHstAmount" DOUBLE PRECISION);
      INSERT INTO income_entries VALUES ('income', 1.005, 0.2, 0.1, 999);
      INSERT INTO vehicle_expenses VALUES ('expense', 1e20, 0.005);`);
    await assert.rejects(migratePostgresMoney(client), /migration stopped/);
    assert.equal((await client.query('SELECT "netFare" FROM income_entries')).rows[0].netFare, 1.005);
    await client.query("UPDATE vehicle_expenses SET amount = 2.675");
    await migratePostgresMoney(client); await migratePostgresMoney(client);
    assert.deepEqual((await client.query('SELECT * FROM income_entries')).rows[0], { id: "income", netFare: "1.01", tips: "0.20", taxes: "0.10", totalEarnings: "1.11" });
    assert.deepEqual((await client.query('SELECT * FROM vehicle_expenses')).rows[0], { id: "expense", amount: "2.68", gstHstAmount: "0.01" });
  } finally {
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    client.release(); await pool.end();
  }
});
