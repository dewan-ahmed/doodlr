// Overridable via env for fast integration tests (see server/test/chunk8-round-timer.mjs).
export const ROUND_DURATION_MS = Number(process.env.ROUND_DURATION_MS) || 80_000;
export const GUESSER_MIN_POINTS = 10;
export const GUESSER_MAX_POINTS = 100;
export const DRAWER_POINTS_PER_CORRECT_GUESS = 20;
