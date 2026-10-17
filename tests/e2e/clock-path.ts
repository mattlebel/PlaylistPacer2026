import path from "node:path";

/** Shared between the Playwright config (server env) and the tests (writers). */
// Outside test-results/, which Playwright clears at the start of a run.
export const CLOCK_FILE = path.join(__dirname, "..", "..", ".data", "e2e-clock.txt");
