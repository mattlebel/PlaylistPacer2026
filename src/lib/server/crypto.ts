import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// No 0/O/1/I/L so ids survive being read aloud or retyped.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function newId(length = 10) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** A secret for manage/edit links. Only its hash is stored. */
export function newKey() {
  return randomBytes(24).toString("base64url");
}

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function keyMatches(key: string | null | undefined, hash: string | null | undefined) {
  if (!key || !hash) return false;
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
