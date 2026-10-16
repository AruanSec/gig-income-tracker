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
  // Legacy PBKDF2 hashes require an administrator reset; do not keep weak credentials usable.
  if (!storedHash.startsWith("scrypt$")) return false;
  const candidate = await hashPassword(password, salt);
  const left = Buffer.from(candidate);
  const right = Buffer.from(storedHash);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

