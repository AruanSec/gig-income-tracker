import crypto from "node:crypto";
// Password Cryptography Helpers
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key));
  });
  return `scrypt$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const candidate = storedHash.startsWith("scrypt$")
    ? await hashPassword(password, salt)
    : crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  const left = Buffer.from(candidate);
  const right = Buffer.from(storedHash);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

