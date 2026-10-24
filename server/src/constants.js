// Overridable via env for fast integration tests (see server/test/chunk8-round-timer.mjs).
export const ROUND_DURATION_MS = Number(process.env.ROUND_DURATION_MS) || 80_000;
export const GUESSER_MIN_POINTS = 10;
export const GUESSER_MAX_POINTS = 100;
export const DRAWER_POINTS_PER_CORRECT_GUESS = 20;

// How many turns each player gets to draw over the course of a game.
export const ROUNDS_PER_PLAYER = Number(process.env.ROUNDS_PER_PLAYER) || 2;

// Pause between a round ending (reveal word / show results) and the next
// round starting, so players have time to read what happened.
export const ROUND_END_DELAY_MS = Number(process.env.ROUND_END_DELAY_MS) || 4_000;

// How long a disconnected player's score/identity is remembered so a page
// refresh (same clientId) can rejoin without losing progress.
export const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 2 * 60_000;

// Bounds for host-configurable per-room settings (see room:settings:update).
export const MIN_ROUNDS_PER_PLAYER = 1;
export const MAX_ROUNDS_PER_PLAYER = 5;
export const MIN_ROUND_DURATION_MS = 30_000;
export const MAX_ROUND_DURATION_MS = 180_000;
