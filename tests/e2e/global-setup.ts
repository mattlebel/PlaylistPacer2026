import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CLOCK_FILE } from "./clock-path";

export default function globalSetup() {
  mkdirSync(dirname(CLOCK_FILE), { recursive: true });
  writeFileSync(CLOCK_FILE, "2026-10-20T12:00:00-04:00");
}
