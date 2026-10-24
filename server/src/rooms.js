import { nanoid } from "nanoid";

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
    round: 0,
    createdAt: Date.now(),
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

export function addPlayer(room, socketId, name) {
  const isHost = room.players.size === 0;
  const player = { id: socketId, name, score: 0, isHost };
  room.players.set(socketId, player);
  return player;
}

export function removePlayer(room, socketId) {
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

export function listPlayers(room) {
  return [...room.players.values()];
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
