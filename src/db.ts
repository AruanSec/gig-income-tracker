import { migrateSqliteMoney, migratePostgresMoney, decodeMoneyRows } from "./moneyMigration";
import pg from "pg";
import Database from "better-sqlite3";
import path from "path";

const { Pool } = pg;

export interface DBClient {
  isPostgres: boolean;
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DBClient) => Promise<T>): Promise<T>;
}

// PostgreSQL Connection configuration
const databaseUrl = process.env.DATABASE_URL;
const postgresHost = process.env.POSTGRES_HOST;
const postgresPort = process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432;
const postgresUser = process.env.POSTGRES_USER || "postgres";
const postgresPassword = process.env.POSTGRES_PASSWORD || "postgres";
const postgresDb = process.env.POSTGRES_DB || "tax_mileage_db";

let pool: pg.Pool | null = null;
let sqliteDb: Database.Database | null = null;
let isPgActive = false;

// Create PostgreSQL connection pool
if (databaseUrl || postgresHost || process.env.NODE_ENV === "production" || process.env.DOCKER_CONTAINER) {
  pool = new Pool({
    connectionString: databaseUrl || `postgresql://${postgresUser}:${postgresPassword}@${postgresHost || "localhost"}:${postgresPort}/${postgresDb}`,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
    query_timeout: 5000,
  });
} else {
  // Default to PostgreSQL connection pool targeting localhost
  pool = new Pool({
    connectionString: `postgresql://${postgresUser}:${postgresPassword}@localhost:${postgresPort}/${postgresDb}`,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    max: 20,
    query_timeout: 5000,
  });
}

// An idle connection may fail during a database restart. Keep the process alive
// so readiness can report the outage and the pool can reconnect afterward.
pool?.on("error", error => console.error("PostgreSQL idle connection error:", error));

// Translate PostgreSQL parameterized queries ($1, $2, ...) to SQLite (?) if fallback is needed
function convertPgParamsToSqlite(sql: string): string {
  return sql.replace(/\$\d+/g, "?");
}

export async function initDatabase(): Promise<DBClient> {
  // Attempt PostgreSQL initialization
  if (pool) {
    try {
      console.log("Connecting to PostgreSQL database...");
      const client = await pool.connect();
      console.log("✅ Successfully connected to PostgreSQL.");
      client.release();
      isPgActive = true;

      // Initialize PostgreSQL Schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS income_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          "startDate" TEXT NOT NULL,
          "endDate" TEXT NOT NULL,
          trips INTEGER NOT NULL,
          "onlineMinutes" INTEGER NOT NULL,
          "activeMinutes" INTEGER NOT NULL,
          "netFare" DOUBLE PRECISION NOT NULL,
          tips DOUBLE PRECISION NOT NULL,
          taxes DOUBLE PRECISION NOT NULL,
          "totalEarnings" DOUBLE PRECISION NOT NULL,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS mileage_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          purpose TEXT NOT NULL,
          "startOdometer" DOUBLE PRECISION NOT NULL,
          "endOdometer" DOUBLE PRECISION NOT NULL,
          distance DOUBLE PRECISION NOT NULL,
          "tripType" TEXT NOT NULL,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS vehicle_expenses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          description TEXT NOT NULL,
          "gstHstEligible" INTEGER NOT NULL DEFAULT 0,
          "gstHstAmount" DOUBLE PRECISION DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS cra_rates (
          user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          year TEXT NOT NULL,
          tier1_threshold DOUBLE PRECISION NOT NULL,
          tier1_rate DOUBLE PRECISION NOT NULL,
          tier2_rate DOUBLE PRECISION NOT NULL,
          PRIMARY KEY (user_id, year)
        );
      `);

      const migrationClient = await pool.connect();
      try { await migratePostgresMoney(migrationClient); }
      finally { migrationClient.release(); }

      await pool.query('CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS income_user_date_idx ON income_entries (user_id, "startDate")');
      await pool.query('CREATE INDEX IF NOT EXISTS mileage_user_date_idx ON mileage_entries (user_id, date)');
      await pool.query('CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON vehicle_expenses (user_id, date)');

      return {
        isPostgres: true,
        async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[] }> {
          const res = await pool!.query(sql, params);
          return { rows: decodeMoneyRows(res.rows) };
        },
        async exec(sql: string): Promise<void> {
          await pool!.query(sql);
        },
        async transaction<T>(fn: (tx: DBClient) => Promise<T>): Promise<T> {
          const client = await pool!.connect();
          const tx: DBClient = {
            isPostgres: true,
            async query<U = any>(sql: string, params: any[] = []) {
              const res = await client.query(sql, params);
              return { rows: decodeMoneyRows(res.rows) as U[] };
            },
            async exec(sql: string) { await client.query(sql); },
            async transaction<U>(nested: (nestedTx: DBClient) => Promise<U>) { return nested(tx); },
          };
          try {
            await client.query("BEGIN");
            const result = await fn(tx);
            await client.query("COMMIT");
            return result;
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        },
      };
    } catch (err: any) {
      if (isPgActive || process.env.NODE_ENV === "production") throw err;
      console.warn("⚠️ PostgreSQL connection not reachable, falling back to local storage engine:", err.message);
    }
  }

  // Fallback engine if Postgres server is not running in sandbox environment
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "database.db");
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("foreign_keys = ON");
  console.log("Using embedded database fallback:", dbPath);

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      trips INTEGER NOT NULL,
      onlineMinutes INTEGER NOT NULL,
      activeMinutes INTEGER NOT NULL,
      netFare REAL NOT NULL,
      tips REAL NOT NULL,
      taxes REAL NOT NULL,
      totalEarnings REAL NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS mileage_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      purpose TEXT NOT NULL,
      startOdometer REAL NOT NULL,
      endOdometer REAL NOT NULL,
      distance REAL NOT NULL,
      tripType TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS vehicle_expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      gstHstEligible INTEGER NOT NULL,
      gstHstAmount REAL
    );

    CREATE TABLE IF NOT EXISTS cra_rates (
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      year TEXT NOT NULL,
      tier1_threshold REAL NOT NULL,
      tier1_rate REAL NOT NULL,
      tier2_rate REAL NOT NULL,
      PRIMARY KEY (user_id, year)
    );
  `);

  migrateSqliteMoney(sqliteDb);

  sqliteDb.exec(`
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
    CREATE INDEX IF NOT EXISTS income_user_date_idx ON income_entries (user_id, startDate);
    CREATE INDEX IF NOT EXISTS mileage_user_date_idx ON mileage_entries (user_id, date);
    CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON vehicle_expenses (user_id, date);
  `);

  return {
    isPostgres: false,
    async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[] }> {
      const sqliteSql = convertPgParamsToSqlite(sql);
      const isSelect = /^\s*SELECT/i.test(sqliteSql);
      if (isSelect) {
        const rows = sqliteDb!.prepare(sqliteSql).all(...params) as T[];
        return { rows: decodeMoneyRows(rows) };
      } else {
        const info = sqliteDb!.prepare(sqliteSql).run(...params);
        return { rows: [] as T[] };
      }
    },
    async exec(sql: string): Promise<void> {
      sqliteDb!.exec(sql);
    },
    async transaction<T>(fn: (tx: DBClient) => Promise<T>): Promise<T> {
      sqliteDb!.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(this);
        sqliteDb!.exec("COMMIT");
        return result;
      } catch (error) {
        sqliteDb!.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
