import { generateSalt, hashPassword, verifyPassword } from "./src/passwordSecurity";
import { sessionToken, tokenDigest, setSessionCookie, securityEvent, SESSION_AGE } from "./src/sessionSecurity";
import { configureProxy, authenticationRateLimit, apiError, requestErrorHandler } from "./src/httpPolicy";
import { sumMoney } from "./src/money";
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { initDatabase, DBClient } from "./src/db";
import { normalizeEmail, parseCraRate, parseExpense, parseIncome, parseMileage, validatePassword, ValidationError } from "./src/validation";

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  configureProxy(app);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
    }
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    // Cross-origin browser writes are rejected before any authentication work.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      const expected = `${req.protocol}://${req.get("host")}`;
      const usesCookie = Boolean(req.headers.cookie) && !req.headers.authorization;
      if ((origin && origin !== expected) || (usesCookie && !origin) || req.get("sec-fetch-site") === "cross-site") {
        securityEvent(req, "csrf", "blocked");
        res.status(403).json({ error: "Cross-origin request denied." }); return;
      }
    }
    // Audit privileged changes, backups/restores and authentication outcomes.
    if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/admin") || req.path === "/api/restore" || req.path === "/api/backup") {
      res.on("finish", () => securityEvent(req, req.path.startsWith("/api/admin/users/") ? `admin_user_${req.method.toLowerCase()}` :
        req.path.startsWith("/api/admin/data/") ? `admin_record_${req.method.toLowerCase()}` : `${req.method} ${req.route?.path || "unknown_route"}`,
        String(res.statusCode), typeof req.params.id === "string" ? req.params.id.slice(0, 80) : undefined));
    }
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", (req, res, next) => {
    if (Array.isArray(req.body)) { res.status(400).json({ error: "A JSON object is required." }); return; }
    next();
  });

  // Initialize PostgreSQL / resilient DB layer
  const db: DBClient = await initDatabase();

  const authRateLimit = authenticationRateLimit();
  const accountLimit = authenticationRateLimit(15 * 60_000, 20, 10_000, req => (req as any).userId);
  const adminCredentialLimit = authenticationRateLimit(15 * 60_000, 20, 10_000, req => (req as any).userId);
  const credentialClientLimit = authenticationRateLimit();
  const aiLimit = authenticationRateLimit(60 * 60_000, 5, 10_000, req => (req as any).userId);

  // Request Auth Middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    const token = sessionToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized: No valid session provided" });
    try {
      const result = await db.query("SELECT * FROM sessions WHERE id = $1", [tokenDigest(token)]);
      const session = result.rows[0];
      if (!session) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
      }

      const now = new Date().toISOString();
      const expiresAtStr = typeof session.expires_at === "string" ? session.expires_at : new Date(session.expires_at).toISOString();
      if (expiresAtStr < now) {
        await db.query("DELETE FROM sessions WHERE id = $1", [tokenDigest(token)]);
        return res.status(401).json({ error: "Unauthorized: Session expired" });
      }

      req.userId = session.user_id;
      req.sessionId = session.id;
      next();
    } catch (err: any) {
      return apiError(res, err);
    }
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    await requireAuth(req, res, async () => {
      try {
        const result = await db.query("SELECT role FROM users WHERE id = $1", [req.userId]);
        const user = result.rows[0];
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Forbidden: Admin privileges required" });
        }
        next();
      } catch (err: any) {
        return apiError(res, err);
      }
    });
  };

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await db.checkHealth();
      res.json({ status: "ok", database: db.isPostgres ? "PostgreSQL" : "SQLite Fallback" });
    } catch {
      res.status(503).json({ status: "unavailable", database: db.isPostgres ? "PostgreSQL" : "SQLite Fallback" });
    }
  });

  app.get("/api/live", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok" });
  });

  // Auth API
  // Accounts are provisioned by administrators, never by an anonymous registration flow.
  app.post("/api/auth/signup", authRateLimit, (_req, res) => {
    res.status(403).json({ error: "Accounts must be created by an administrator." });
  });

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === "string" && req.body.password.length <= 128 ? req.body.password : "";
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];
      if (!user) {
        await hashPassword(password || "invalid-password", "timing-padding");
        return res.status(400).json({ error: "Invalid email or password" });
      }

      if (!password || !(await verifyPassword(password, user.salt, user.password_hash))) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      if (!user.password_hash.startsWith("scrypt$")) {
        await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password, user.salt), user.id]);
      }

      // Create Session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_AGE).toISOString(); // Eight-hour absolute expiry
      await db.query(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
        [tokenDigest(token), user.id, expiresAt]
      );

      setSessionCookie(req, res, token);
      return res.json(req.get("X-Auth-Mode") === "bearer" ? { token, email } : { email });
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = sessionToken(req);
    if (token) {
      try { await db.query("DELETE FROM sessions WHERE id = $1", [tokenDigest(token)]); }
      catch (error) { return apiError(res, error); }
    }
    setSessionCookie(req, res, null);
    return res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const result = await db.query("SELECT email, role FROM users WHERE id = $1", [req.userId]);
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({ email: user.email, role: user.role || "user" });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/auth/change-password", requireAuth, credentialClientLimit, accountLimit, async (req: any, res) => {
    const { oldPassword, newPassword } = req.body ?? {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    try {
      if (typeof oldPassword !== "string") throw new ValidationError("Current password must be a string.");
      validatePassword(newPassword);
      const result = await db.query("SELECT * FROM users WHERE id = $1", [req.userId]);
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      if (!(await verifyPassword(oldPassword, user.salt, user.password_hash))) {
        return res.status(400).json({ error: "Incorrect current password." });
      }

      const newSalt = generateSalt();
      const newPasswordHash = await hashPassword(newPassword, newSalt);

      await db.transaction(async (tx) => {
        await tx.query("UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3", [newPasswordHash, newSalt, req.userId]);
        await tx.query("DELETE FROM sessions WHERE user_id = $1 AND id != $2", [req.userId, req.sessionId]);
      });

      return res.json({ success: true, message: "Password changed successfully." });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  // Income entries API
  app.get("/api/income", requireAuth, async (req: any, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM income_entries WHERE user_id = $1 ORDER BY "startDate" DESC',
        [req.userId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/income", requireAuth, async (req: any, res) => {
    const id = "entry-" + crypto.randomBytes(8).toString("hex");
    try {
      const { startDate, endDate, trips, onlineMinutes, activeMinutes, netFare, tips, taxes, totalEarnings, notes } = parseIncome(req.body);
      await db.query(
        `INSERT INTO income_entries (id, user_id, "startDate", "endDate", trips, "onlineMinutes", "activeMinutes", "netFare", tips, taxes, "totalEarnings", notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, req.userId, startDate, endDate, trips, onlineMinutes, activeMinutes, netFare, tips, taxes, totalEarnings, notes || ""]
      );

      const result = await db.query("SELECT * FROM income_entries WHERE id = $1", [id]);
      return res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.put("/api/income/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const { startDate, endDate, trips, onlineMinutes, activeMinutes, netFare, tips, taxes, totalEarnings, notes } = parseIncome(req.body);
      const existing = await db.query("SELECT * FROM income_entries WHERE id = $1 AND user_id = $2", [id, req.userId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Entry not found" });
      }

      await db.query(
        `UPDATE income_entries
         SET "startDate" = $1, "endDate" = $2, trips = $3, "onlineMinutes" = $4, "activeMinutes" = $5, "netFare" = $6, tips = $7, taxes = $8, "totalEarnings" = $9, notes = $10
         WHERE id = $11 AND user_id = $12`,
        [startDate, endDate, trips, onlineMinutes, activeMinutes, netFare, tips, taxes, totalEarnings, notes || "", id, req.userId]
      );

      const result = await db.query("SELECT * FROM income_entries WHERE id = $1", [id]);
      return res.json(result.rows[0]);
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.delete("/api/income/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const existing = await db.query("SELECT * FROM income_entries WHERE id = $1 AND user_id = $2", [id, req.userId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Entry not found" });
      }
      await db.query("DELETE FROM income_entries WHERE id = $1 AND user_id = $2", [id, req.userId]);
      return res.json({ success: true });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  // Mileage entries API
  app.get("/api/mileage", requireAuth, async (req: any, res) => {
    try {
      const result = await db.query(
        "SELECT * FROM mileage_entries WHERE user_id = $1 ORDER BY date DESC",
        [req.userId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/mileage", requireAuth, async (req: any, res) => {
    const id = "mileage-" + crypto.randomBytes(8).toString("hex");
    try {
      const { date, purpose, startOdometer, endOdometer, distance, tripType, notes } = parseMileage(req.body);
      await db.query(
        `INSERT INTO mileage_entries (id, user_id, date, purpose, "startOdometer", "endOdometer", distance, "tripType", notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, req.userId, date, purpose, startOdometer, endOdometer, distance, tripType, notes || ""]
      );

      const result = await db.query("SELECT * FROM mileage_entries WHERE id = $1", [id]);
      return res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.put("/api/mileage/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const { date, purpose, startOdometer, endOdometer, distance, tripType, notes } = parseMileage(req.body);
      const existing = await db.query("SELECT * FROM mileage_entries WHERE id = $1 AND user_id = $2", [id, req.userId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Entry not found" });
      }

      await db.query(
        `UPDATE mileage_entries
         SET date = $1, purpose = $2, "startOdometer" = $3, "endOdometer" = $4, distance = $5, "tripType" = $6, notes = $7
         WHERE id = $8 AND user_id = $9`,
        [date, purpose, startOdometer, endOdometer, distance, tripType, notes || "", id, req.userId]
      );

      const result = await db.query("SELECT * FROM mileage_entries WHERE id = $1", [id]);
      return res.json(result.rows[0]);
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.delete("/api/mileage/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const existing = await db.query("SELECT * FROM mileage_entries WHERE id = $1 AND user_id = $2", [id, req.userId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Entry not found" });
      }
      await db.query("DELETE FROM mileage_entries WHERE id = $1 AND user_id = $2", [id, req.userId]);
      return res.json({ success: true });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  // Vehicle expenses API
  app.get("/api/expenses", requireAuth, async (req: any, res) => {
    try {
      const result = await db.query(
        "SELECT * FROM vehicle_expenses WHERE user_id = $1 ORDER BY date DESC",
        [req.userId]
      );
      const formatted = result.rows.map((item: any) => ({
        ...item,
        gstHstEligible: !!item.gstHstEligible,
      }));
      return res.json(formatted);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/expenses", requireAuth, async (req: any, res) => {
    const id = "exp-" + crypto.randomBytes(8).toString("hex");
    try {
      const { date, category, amount, description, gstHstEligible, gstHstAmount } = parseExpense(req.body);
      await db.query(
        `INSERT INTO vehicle_expenses (id, user_id, date, category, amount, description, "gstHstEligible", "gstHstAmount")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, req.userId, date, category, amount, description, gstHstEligible ? 1 : 0, gstHstAmount || 0]
      );

      const result = await db.query("SELECT * FROM vehicle_expenses WHERE id = $1", [id]);
      const entry = result.rows[0];
      if (entry) {
        entry.gstHstEligible = !!entry.gstHstEligible;
      }
      return res.status(201).json(entry);
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.put("/api/expenses/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const { date, category, amount, description, gstHstEligible, gstHstAmount } = parseExpense(req.body);
      const existing = await db.query("SELECT * FROM vehicle_expenses WHERE id = $1 AND user_id = $2", [id, req.userId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }

      await db.query(
        `UPDATE vehicle_expenses
         SET date = $1, category = $2, amount = $3, description = $4, "gstHstEligible" = $5, "gstHstAmount" = $6
         WHERE id = $7 AND user_id = $8`,
        [date, category, amount, description, gstHstEligible ? 1 : 0, gstHstAmount || 0, id, req.userId]
      );

      const result = await db.query("SELECT * FROM vehicle_expenses WHERE id = $1", [id]);
      const entry = result.rows[0];
      if (entry) {
        entry.gstHstEligible = !!entry.gstHstEligible;
      }
      return res.json(entry);
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const existing = await db.query("SELECT * FROM vehicle_expenses WHERE id = $1 AND user_id = $2", [id, req.userId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }
      await db.query("DELETE FROM vehicle_expenses WHERE id = $1 AND user_id = $2", [id, req.userId]);
      return res.json({ success: true });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  // Backup / Restore API
  app.get("/api/backup", requireAuth, async (req: any, res) => {
    try {
      const incomeRes = await db.query('SELECT * FROM income_entries WHERE user_id = $1 ORDER BY "startDate" DESC', [req.userId]);
      const mileageRes = await db.query("SELECT * FROM mileage_entries WHERE user_id = $1 ORDER BY date DESC", [req.userId]);
      const expenseRes = await db.query("SELECT * FROM vehicle_expenses WHERE user_id = $1 ORDER BY date DESC", [req.userId]);

      const ratesRes = await db.query("SELECT year, tier1_threshold, tier1_rate, tier2_rate FROM cra_rates WHERE user_id = $1 ORDER BY year DESC", [req.userId]);
      const expenses = expenseRes.rows.map((item: any) => ({
        ...item,
        gstHstEligible: !!item.gstHstEligible,
      }));

      return res.json({
        schemaVersion: 1,
        craRates: ratesRes.rows,
        income: incomeRes.rows,
        mileage: mileageRes.rows,
        expenses,
      });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/restore", requireAuth, async (req: any, res) => {
    const { income, mileage, expenses, schemaVersion, craRates } = req.body ?? {};
    if (!Array.isArray(income) || !Array.isArray(mileage) || !Array.isArray(expenses)) {
      return res.status(400).json({ error: "Invalid backup data structure" });
    }

    try {
      if (income.length + mileage.length + expenses.length > 10_000) {
        return res.status(400).json({ error: "A backup may contain at most 10,000 records." });
      }
      if (schemaVersion !== undefined && schemaVersion !== 1) throw new ValidationError("Unsupported backup schema version.");
      if ((schemaVersion === 1 || craRates !== undefined) && (!Array.isArray(craRates) || craRates.length > 200)) {
        throw new ValidationError("Backup CRA rates must be an array of at most 200 rates.");
      }
      const cleanRates = craRates === undefined ? undefined : craRates.map(parseCraRate);
      if (cleanRates && new Set(cleanRates.map(rate => rate.year)).size !== cleanRates.length) throw new ValidationError("Backup contains duplicate rate years.");
      const cleanIncome = income.map(parseIncome);
      const cleanMileage = mileage.map(parseMileage);
      const cleanExpenses = expenses.map(parseExpense);
      await db.transaction(async (tx) => {
        // Legacy, unversioned backups preserve the user's current rate settings.
        if (cleanRates !== undefined) {
          await tx.query("DELETE FROM cra_rates WHERE user_id = $1", [req.userId]);
          for (const rate of cleanRates) {
            await tx.query("INSERT INTO cra_rates (user_id, year, tier1_threshold, tier1_rate, tier2_rate) VALUES ($1, $2, $3, $4, $5)",
              [req.userId, rate.year, rate.tier1_threshold, rate.tier1_rate, rate.tier2_rate]);
          }
        }
        // Clear existing data for user
        await tx.query("DELETE FROM income_entries WHERE user_id = $1", [req.userId]);
        await tx.query("DELETE FROM mileage_entries WHERE user_id = $1", [req.userId]);
        await tx.query("DELETE FROM vehicle_expenses WHERE user_id = $1", [req.userId]);

        // Insert income entries
        for (let index = 0; index < cleanIncome.length; index++) {
          const item = cleanIncome[index];
          await tx.query(
            `INSERT INTO income_entries (id, user_id, "startDate", "endDate", trips, "onlineMinutes", "activeMinutes", "netFare", tips, taxes, "totalEarnings", notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              "entry-" + crypto.randomBytes(8).toString("hex"),
              req.userId,
              item.startDate,
              item.endDate,
              item.trips,
              item.onlineMinutes,
              item.activeMinutes,
              item.netFare,
              item.tips,
              item.taxes,
              item.totalEarnings,
              item.notes || "",
            ]
          );
        }

        // Insert mileage entries
        for (let index = 0; index < cleanMileage.length; index++) {
          const item = cleanMileage[index];
          await tx.query(
            `INSERT INTO mileage_entries (id, user_id, date, purpose, "startOdometer", "endOdometer", distance, "tripType", notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              "mileage-" + crypto.randomBytes(8).toString("hex"),
              req.userId,
              item.date,
              item.purpose,
              item.startOdometer,
              item.endOdometer,
              item.distance,
              item.tripType,
              item.notes || "",
            ]
          );
        }

        // Insert vehicle expenses
        for (let index = 0; index < cleanExpenses.length; index++) {
          const item = cleanExpenses[index];
          await tx.query(
            `INSERT INTO vehicle_expenses (id, user_id, date, category, amount, description, "gstHstEligible", "gstHstAmount")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              "exp-" + crypto.randomBytes(8).toString("hex"),
              req.userId,
              item.date,
              item.category,
              item.amount,
              item.description,
              item.gstHstEligible ? 1 : 0,
              item.gstHstAmount || 0,
            ]
          );
        }
      });

      return res.json({ success: true });
    } catch (err: unknown) {
      return apiError(res, err);
    }
  });

  // CRA Rates API
  app.get("/api/settings/cra-rates", requireAuth, async (req: any, res) => {
    try {
      let result = await db.query(
        "SELECT year, tier1_threshold, tier1_rate, tier2_rate FROM cra_rates WHERE user_id = $1 ORDER BY year DESC",
        [req.userId]
      );
      let rates = result.rows;
      return res.json(rates);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/settings/cra-rates", requireAuth, async (req: any, res) => {
    try {
      const { year, tier1_threshold, tier1_rate, tier2_rate } = parseCraRate(req.body);
      await db.query(
        `INSERT INTO cra_rates (user_id, year, tier1_threshold, tier1_rate, tier2_rate)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, year) DO UPDATE SET
           tier1_threshold = EXCLUDED.tier1_threshold,
           tier1_rate = EXCLUDED.tier1_rate,
           tier2_rate = EXCLUDED.tier2_rate`,
        [req.userId, year, tier1_threshold, tier1_rate, tier2_rate]
      );

      const result = await db.query(
        "SELECT year, tier1_threshold, tier1_rate, tier2_rate FROM cra_rates WHERE user_id = $1 ORDER BY year DESC",
        [req.userId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  // Admin Portal API Endpoints
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const usersRes = await db.query("SELECT COUNT(*) as count FROM users");
      const incomeRes = await db.query("SELECT COUNT(*) as count FROM income_entries");
      const mileageRes = await db.query("SELECT COUNT(*) as count FROM mileage_entries");
      const expensesRes = await db.query("SELECT COUNT(*) as count FROM vehicle_expenses");
      const sessionsRes = await db.query("SELECT COUNT(*) as count FROM sessions");
      const craRatesRes = await db.query("SELECT COUNT(*) as count FROM cra_rates");

      const earningsSumRes = await db.query('SELECT "totalEarnings" FROM income_entries');
      const distanceSumRes = await db.query("SELECT SUM(distance) as sum FROM mileage_entries");
      const expensesSumRes = await db.query("SELECT amount FROM vehicle_expenses");

      const tables = [
        { name: "users", count: parseInt(usersRes.rows[0]?.count || "0", 10) },
        { name: "sessions", count: parseInt(sessionsRes.rows[0]?.count || "0", 10) },
        { name: "income_entries", count: parseInt(incomeRes.rows[0]?.count || "0", 10) },
        { name: "mileage_entries", count: parseInt(mileageRes.rows[0]?.count || "0", 10) },
        { name: "vehicle_expenses", count: parseInt(expensesRes.rows[0]?.count || "0", 10) },
        { name: "cra_rates", count: parseInt(craRatesRes.rows[0]?.count || "0", 10) },
      ];

      return res.json({
        usersCount: parseInt(usersRes.rows[0]?.count || "0", 10),
        incomeCount: parseInt(incomeRes.rows[0]?.count || "0", 10),
        mileageCount: parseInt(mileageRes.rows[0]?.count || "0", 10),
        expensesCount: parseInt(expensesRes.rows[0]?.count || "0", 10),
        totalEarnings: sumMoney(earningsSumRes.rows, (row: any) => row.totalEarnings),
        totalDistance: parseFloat(distanceSumRes.rows[0]?.sum || "0"),
        totalExpenses: sumMoney(expensesSumRes.rows, (row: any) => row.amount),
        tables,
      });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.get("/api/admin/users", requireAdmin, adminCredentialLimit, async (req, res) => {
    try {
      const result = await db.query(`
        SELECT u.id, u.email, u.role, u.created_at,
          (SELECT COUNT(*) FROM income_entries WHERE user_id = u.id) as "incomeCount",
          (SELECT COUNT(*) FROM mileage_entries WHERE user_id = u.id) as "mileageCount",
          (SELECT COUNT(*) FROM vehicle_expenses WHERE user_id = u.id) as "expenseCount"
        FROM users u
        ORDER BY u.created_at DESC
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.post("/api/admin/users", requireAdmin, adminCredentialLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = validatePassword(req.body?.password);
      const role = req.body?.role ?? "user";
      if (role !== "user" && role !== "admin") throw new ValidationError("Role must be user or admin.");
      const existingUserResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (existingUserResult.rows.length > 0) {
        return res.status(400).json({ error: "User already exists with this email" });
      }

      const userId = "usr-" + crypto.randomBytes(8).toString("hex");
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);

      await db.query(
        "INSERT INTO users (id, email, password_hash, salt, role) VALUES ($1, $2, $3, $4, $5)",
        [userId, email, passwordHash, salt, role || "user"]
      );

      const result = await db.query(`
        SELECT u.id, u.email, u.role, u.created_at,
          0 as "incomeCount", 0 as "mileageCount", 0 as "expenseCount"
        FROM users u WHERE u.id = $1
      `, [userId]);

      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, adminCredentialLimit, async (req, res) => {
    const { id } = req.params;
    try {
      const email = normalizeEmail(req.body?.email);
      const role = req.body?.role ?? "user";
      if (role !== "user" && role !== "admin") throw new ValidationError("Role must be user or admin.");
      const password = req.body?.password;
      const existing = await db.query("SELECT * FROM users WHERE id = $1", [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const duplicate = await db.query("SELECT * FROM users WHERE email = $1 AND id != $2", [email, id]);
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: "Email is already taken by another user" });
      }

      if (password !== undefined && password !== "") {
        const salt = generateSalt();
        validatePassword(password);
        const passwordHash = await hashPassword(password, salt);
        await db.transaction(async tx => {
          await tx.query(
            "UPDATE users SET email = $1, role = $2, password_hash = $3, salt = $4 WHERE id = $5",
            [email, role, passwordHash, salt, id]
          );
          await tx.query("DELETE FROM sessions WHERE user_id = $1", [id]);
        });
      } else {
        await db.query(
          "UPDATE users SET email = $1, role = $2 WHERE id = $3",
          [email, role || "user", id]
        );
      }

      const result = await db.query(`
        SELECT u.id, u.email, u.role, u.created_at,
          (SELECT COUNT(*) FROM income_entries WHERE user_id = u.id) as "incomeCount",
          (SELECT COUNT(*) FROM mileage_entries WHERE user_id = u.id) as "mileageCount",
          (SELECT COUNT(*) FROM vehicle_expenses WHERE user_id = u.id) as "expenseCount"
        FROM users u WHERE u.id = $1
      `, [id]);

      return res.json(result.rows[0]);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, adminCredentialLimit, async (req: any, res) => {
    const { id } = req.params;
    if (id === req.userId) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }
    try {
      const existing = await db.query("SELECT * FROM users WHERE id = $1", [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      await db.query("DELETE FROM users WHERE id = $1", [id]);
      return res.json({ success: true, message: "User and all associated data deleted successfully" });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.get("/api/admin/data/income", requireAdmin, async (req, res) => {
    try {
      const result = await db.query(`
        SELECT i.*, u.email as "userEmail"
        FROM income_entries i
        JOIN users u ON i.user_id = u.id
        ORDER BY i."startDate" DESC
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.get("/api/admin/data/mileage", requireAdmin, async (req, res) => {
    try {
      const result = await db.query(`
        SELECT m.*, u.email as "userEmail"
        FROM mileage_entries m
        JOIN users u ON m.user_id = u.id
        ORDER BY m.date DESC
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.get("/api/admin/data/expenses", requireAdmin, async (req, res) => {
    try {
      const result = await db.query(`
        SELECT e.*, u.email as "userEmail"
        FROM vehicle_expenses e
        JOIN users u ON e.user_id = u.id
        ORDER BY e.date DESC
      `);
      return res.json(result.rows);
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.delete("/api/admin/data/income/:id", requireAdmin, async (req, res) => {
    try {
      await db.query("DELETE FROM income_entries WHERE id = $1", [req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.delete("/api/admin/data/mileage/:id", requireAdmin, async (req, res) => {
    try {
      await db.query("DELETE FROM mileage_entries WHERE id = $1", [req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  app.delete("/api/admin/data/expenses/:id", requireAdmin, async (req, res) => {
    try {
      await db.query("DELETE FROM vehicle_expenses WHERE id = $1", [req.params.id]);
      return res.json({ success: true });
    } catch (err: any) {
      return apiError(res, err);
    }
  });

  // Gemini AI Insights Endpoint
  app.post("/api/insights/earnings-analysis", requireAuth, aiLimit, async (req: any, res) => {
    try {
      const result = await db.query('SELECT * FROM income_entries WHERE user_id = $1 ORDER BY "startDate" DESC LIMIT 250', [req.userId]);
      const incomeEntries = result.rows;
      if (incomeEntries.length === 0) {
        return res.status(400).json({ error: "No income entries provided for analysis." });
      }

      // Format logs for prompt
      const entriesSummary = incomeEntries
        .map((e: any, index: number) => {
          const onlineHours = (e.onlineMinutes || 0) / 60;
          const activeHours = (e.activeMinutes || 0) / 60;
          const hourlyRate = onlineHours > 0 ? (e.totalEarnings / onlineHours).toFixed(2) : "N/A";
          const tipPct = e.totalEarnings > 0 ? ((e.tips / e.totalEarnings) * 100).toFixed(1) : "0";
          return `Entry ${index + 1}: Date Range: ${e.startDate} to ${e.endDate} | Total Earnings: $${e.totalEarnings} (Net Fare: $${e.netFare}, Tips: $${e.tips}, Tips%: ${tipPct}%) | Trips: ${e.trips} | Online Hours: ${onlineHours.toFixed(1)}h | Active Hours: ${activeHours.toFixed(1)}h | Effective Hourly Rate: $${hourlyRate}/hr | Notes: "${e.notes || "None"}"`;
        })
        .join("\n");

      const prompt = `You are an expert gig economy financial and efficiency consultant specializing in rideshare and delivery driver performance analysis.
Analyze the following driver income logs and active/online hours to detect weekly earnings trends, operational inefficiencies, downtime patterns, and actionable advice to maximize earnings per hour.

--- LOGGED DATA ---
${entriesSummary}
--------------------

Provide a structured analysis in JSON format with:
1. weeklyTrendSummary: 2-3 sentence executive summary of overall performance, momentum, and trends.
2. efficiencyRating: Grade/rating (e.g. "Optimal (A)", "Above Average (B+)", "Needs Strategy (C)").
3. averageHourlyRate: Overall average earnings per online hour across entries (number).
4. peakPerformingDayOrShift: Key takeaway of top shift or pattern (string).
5. keyInsights: Array of 3 key observational findings (title, observation, impact).
6. actionableSuggestions: Array of 3-4 concrete efficiency recommendations (category, title, recommendation, expectedBenefit).`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          weeklyTrendSummary: { type: Type.STRING },
          efficiencyRating: { type: Type.STRING },
          averageHourlyRate: { type: Type.NUMBER },
          peakPerformingDayOrShift: { type: Type.STRING },
          keyInsights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                observation: { type: Type.STRING },
                impact: { type: Type.STRING },
              },
              required: ["title", "observation", "impact"],
            },
          },
          actionableSuggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                recommendation: { type: Type.STRING },
                expectedBenefit: { type: Type.STRING },
              },
              required: ["category", "title", "recommendation", "expectedBenefit"],
            },
          },
        },
        required: [
          "weeklyTrendSummary",
          "efficiencyRating",
          "averageHourlyRate",
          "peakPerformingDayOrShift",
          "keyInsights",
          "actionableSuggestions",
        ],
      };

      if (!process.env.GEMINI_API_KEY) {
        // Fallback statistical analysis if GEMINI_API_KEY is missing
        const totalEarningsSum = sumMoney(incomeEntries, (e: any) => e.totalEarnings || 0);
        const totalOnlineMinSum = incomeEntries.reduce((s: number, e: any) => s + (e.onlineMinutes || 0), 0);
        const totalActiveMinSum = incomeEntries.reduce((s: number, e: any) => s + (e.activeMinutes || 0), 0);
        const totalTripsSum = incomeEntries.reduce((s: number, e: any) => s + (e.trips || 0), 0);
        const totalTipsSum = sumMoney(incomeEntries, (e: any) => e.tips || 0);

        const totalOnlineHours = totalOnlineMinSum / 60 || 1;
        const avgHourly = Math.round((totalEarningsSum / totalOnlineHours) * 100) / 100;
        const activeRatio = Math.round((totalActiveMinSum / (totalOnlineMinSum || 1)) * 100);
        const tipRatio = Math.round((totalTipsSum / (totalEarningsSum || 1)) * 100);

        return res.json({
          weeklyTrendSummary: `Based on ${incomeEntries.length} logged shifts totalling $${totalEarningsSum.toFixed(2)}, your average effective rate is $${avgHourly.toFixed(2)}/hr with an active-time utilization of ${activeRatio}%.`,
          efficiencyRating: activeRatio >= 70 ? "Optimal (A-)" : activeRatio >= 50 ? "Good (B)" : "Needs Optimization (C+)",
          averageHourlyRate: avgHourly,
          peakPerformingDayOrShift: "Weekend Peak Shifts & Dinner Rush Hours",
          keyInsights: [
            {
              title: "Active Time Utilization",
              observation: `You were actively fulfilling trips for ${activeRatio}% of your total online time (${(totalActiveMinSum / 60).toFixed(1)}h active vs ${(totalOnlineMinSum / 60).toFixed(1)}h online).`,
              impact: activeRatio < 65 ? "High idle time while online between trips" : "Strong trip dispatch efficiency",
            },
            {
              title: "Tip Contribution Percentage",
              observation: `Customer tips account for $${totalTipsSum.toFixed(2)} (${tipRatio}% of total earnings across ${totalTripsSum} trips).`,
              impact: tipRatio < 15 ? "Opportunity to increase tip per trip with top customer service" : "Excellent tip ratio",
            },
            {
              title: "Trip Velocity",
              observation: `Averaging ${(totalTripsSum / (incomeEntries.length || 1)).toFixed(1)} trips per shift and $${(totalEarningsSum / (totalTripsSum || 1)).toFixed(2)} revenue per trip.`,
              impact: "Steady trip throughput across logged dates",
            },
          ],
          actionableSuggestions: [
            {
              category: "Shift Scheduling",
              title: "Target High-Demand Peak Windows",
              recommendation: "Focus driving time during morning commute (7am-9:30am) and Friday/Saturday dinner rushes (5pm-9pm) to maximize trip density.",
              expectedBenefit: "+$8 - $15 / hour potential gain",
            },
            {
              category: "Downtime Reduction",
              title: "Reposition Closer to Hotspots",
              recommendation: "If waiting more than 10 minutes without a dispatch request, move 1-2 miles toward high-density restaurant/event hubs rather than remaining parked in low-traffic zones.",
              expectedBenefit: "Reduces idle time by 15-25%",
            },
            {
              category: "Tip Optimization",
              title: "Proactive Communication",
              recommendation: "Send a brief polite courtesy message upon accepting deliveries or picking up passengers, keeping thermal bags visible for food deliveries.",
              expectedBenefit: "+10% to +20% boost in tips",
            },
          ],
        });
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.7,
        },
      });

      const jsonText = response.text ? response.text.trim() : "";
      if (!jsonText) {
        throw new Error("Empty response received from Gemini model.");
      }

      const parsedData = JSON.parse(jsonText);
      return res.json(parsedData);
    } catch (err: any) {
      console.error("Gemini Earnings Analysis Error:", err);
      return apiError(res, err);
    }
  });

  app.use("/api", (_req, res) => { res.status(404).json({ error: "API endpoint not found." }); });

  app.use("/api", requestErrorHandler);

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist", "public");
    app.get(/\.(?:cjs|map)$/, (_req, res) => { res.sendStatus(404); });
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use(requestErrorHandler);

  app.listen(PORT, process.env.HOST || "127.0.0.1", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
  process.exitCode = 1;
});
