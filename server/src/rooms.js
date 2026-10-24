import { nanoid } from "nanoid";
import { RECONNECT_GRACE_MS, ROUNDS_PER_PLAYER, ROUND_DURATION_MS } from "./constants.js";

// In-memory room store. No DB — rooms are ephemeral per server process.
// roomCode -> Room
const rooms = new Map();

/**
 * Room shape (will grow as we build out game logic):
 * {
 *   code: string,
 *   players: Map<socketId, { id, name, score, isHost }>,
 *   status: 'lobby' | 'playing' | 'round-end' | 'game-over',
 *   currentDrawerId: string | null,
 *   currentWord: string | null,
 *   round: number,
 *   createdAt: number,
 * }
 */

export function createRoom() {
  const code = generateRoomCode();
  const room = {
    code,
    players: new Map(),
    status: "lobby",
    currentDrawerId: null,
    currentWord: null,
    wordChoices: null,
    correctGuessers: new Set(),
    round: 0,
    roundStartedAt: null,
    roundTimer: null,
    roundEndTimer: null,
    drawerOrder: [],
    turnNumber: 0,
    totalTurns: 0,
    createdAt: Date.now(),
    // clientId -> { name, score, disconnectedAt } — lets a refreshing
    // player resume with their score intact within RECONNECT_GRACE_MS.
    disconnectedPlayers: new Map(),
    // Host-configurable before the game starts (see room:settings:update).
    settings: {
      roundsPerPlayer: ROUNDS_PER_PLAYER,
      roundDurationMs: ROUND_DURATION_MS,
    },
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function addPlayer(room, socketId, name, clientId = null) {
  const isHost = room.players.size === 0;

  let score = 0;
  let reconnected = false;
  if (clientId && room.disconnectedPlayers.has(clientId)) {
    const saved = room.disconnectedPlayers.get(clientId);
    room.disconnectedPlayers.delete(clientId);
    if (Date.now() - saved.disconnectedAt <= RECONNECT_GRACE_MS) {
      score = saved.score;
      reconnected = true;
    }
  }

  const player = { id: socketId, name, score, isHost, clientId, reconnected };
  room.players.set(socketId, player);
  return player;
}

export function removePlayer(room, socketId) {
  const player = room.players.get(socketId);
  if (player?.clientId) {
    room.disconnectedPlayers.set(player.clientId, {
      name: player.name,
      score: player.score,
      disconnectedAt: Date.now(),
    });
  }

  room.players.delete(socketId);
  // If the host left, promote the next player (if any).
  if (room.players.size > 0) {
    const stillHasHost = [...room.players.values()].some((p) => p.isHost);
    if (!stillHasHost) {
      const next = room.players.values().next().value;
      next.isHost = true;
    }
  }
}

// Never broadcast clientId — it's the secret that lets a refresh resume a
// player's score, so it must stay private to that player's own socket.
export function listPlayers(room) {
  return [...room.players.values()].map(({ id, name, score, isHost }) => ({
    id,
    name,
    score,
    isHost,
  }));
}

export function isRoomEmpty(room) {
  return room.players.size === 0;
}

function generateRoomCode() {
  // Short, human-shareable code (e.g. "7K2QX"), avoiding collisions with existing rooms.
  let code;
  do {
    code = nanoid(5).toUpperCase();
  } while (rooms.has(code));
  return code;
}
