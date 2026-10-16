// One-time local provisioning. Read JSON from stdin, never passwords from process arguments.
import crypto from "node:crypto";
import { initDatabase } from "../src/db";
import { hashPassword, generateSalt } from "../src/passwordSecurity";
import { normalizeEmail, validatePassword } from "../src/validation";

async function createAdmin() {
try {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 2048) throw new Error("Input too large");
  }
  const lines = input.trimEnd().split("\n");
  const data = input.trimStart().startsWith("{") ? JSON.parse(input) : { email: lines[0], password: lines[1] };
  const email = normalizeEmail(data.email);
  const password = validatePassword(data.password);
  const db = await initDatabase();
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  await db.query("INSERT INTO users (id,email,password_hash,salt,role) VALUES ($1,$2,$3,$4,$5)",
    ["usr-" + crypto.randomBytes(8).toString("hex"), email, passwordHash, salt, "admin"]);
  console.info(JSON.stringify({ type: "security", event: "local_admin_created", outcome: "success" }));
  process.exit(0);
} catch {
  console.error("Administrator creation failed. Check input, database access and whether the account already exists.");
  process.exit(1);
}

}
void createAdmin();
