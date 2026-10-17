import "server-only";
import { readFileSync } from "node:fs";

/**
 * Current time for race rules. End-to-end tests point E2E_CLOCK_FILE at a file holding an
 * ISO timestamp so they can jump to race morning or past the finish. Never set in production.
 */
export function now(): Date {
  const file = process.env.E2E_CLOCK_FILE;
  if (file) {
    try {
      const t = readFileSync(file, "utf8").trim();
      if (t) return new Date(t);
    } catch {
      /* no override written yet */
    }
  }
  return new Date();
}
