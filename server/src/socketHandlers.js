import {
  addPlayer,
  createRoom,
  deleteRoom,
  getRoom,
  isRoomEmpty,
  listPlayers,
  removePlayer,
} from "./rooms.js";
import { getRandomWords } from "./wordBank.js";
import {
  DRAWER_POINTS_PER_CORRECT_GUESS,
  GUESSER_MAX_POINTS,
  GUESSER_MIN_POINTS,
  MAX_ROUND_DURATION_MS,
  MAX_ROUNDS_PER_PLAYER,
  MIN_ROUND_DURATION_MS,
  MIN_ROUNDS_PER_PLAYER,
  ROUND_END_DELAY_MS,
} from "./constants.js";

// Socket.io event skeleton. Game-specific events (drawing strokes, guesses,
// scoring, round timer, etc.) get added here as we build them out.
export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);

    socket.on("room:create", ({ name, clientId }, callback) => {
      const room = createRoom();
      const player = addPlayer(room, socket.id, name, clientId);

      socket.join(room.code);
      socket.data.roomCode = room.code;

      callback?.({
        room: room.code,
        player,
        players: listPlayers(room),
        gameState: null,
        settings: room.settings,
      });
      io.to(room.code).emit("room:players", listPlayers(room));
    });

    socket.on("room:join", ({ code, name, clientId }, callback) => {
      const room = getRoom(code?.toUpperCase());
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      const player = addPlayer(room, socket.id, name, clientId);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      callback?.({
        room: room.code,
        player,
        players: listPlayers(room),
        gameState: buildGameState(room),
        settings: room.settings,
      });
      io.to(room.code).emit("room:players", listPlayers(room));
    });

    socket.on("room:settings:update", ({ roundsPerPlayer, roundDurationMs } = {}) => {
      const code = socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return;
      if (room.status !== "lobby") return; // settings are locked once a game starts

      const player = room.players.get(socket.id);
      if (!player?.isHost) return;

      if (Number.isFinite(roundsPerPlayer)) {
        room.settings.roundsPerPlayer = clamp(
          Math.round(roundsPerPlayer),
          MIN_ROUNDS_PER_PLAYER,
          MAX_ROUNDS_PER_PLAYER
        );
      }

      if (Number.isFinite(roundDurationMs)) {
        room.settings.roundDurationMs = clamp(
          Math.round(roundDurationMs),
          MIN_ROUND_DURATION_MS,
          MAX_ROUND_DURATION_MS
        );
      }

      io.to(room.code).emit("room:settings", room.settings);
    });

    socket.on("game:start", () => {
      const code = socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return;
      if (room.status !== "lobby") return; // ignore if a game is already running

      const players = listPlayers(room);
      if (players.length < 2) return;

      room.drawerOrder = shuffle(players.map((p) => p.id));
      room.turnNumber = 1;
      room.totalTurns = room.drawerOrder.length * room.settings.roundsPerPlayer;
      room.round = 1;
      beginWordChoice(io, room, room.drawerOrder[0]);
    });

    socket.on("word:choose", ({ word }) => {
      const code = socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return;
      if (room.status !== "choosing") return;
      if (socket.id !== room.currentDrawerId) return;
      if (!room.wordChoices?.includes(word)) return;

      room.currentWord = word;
      room.status = "playing";
      room.roundStartedAt = Date.now();

      io.to(room.code).emit("round:start", {
        round: room.round,
        drawerId: room.currentDrawerId,
        wordLength: word.length,
        roundEndsAt: room.roundStartedAt + room.settings.roundDurationMs,
      });

      if (room.roundTimer) clearTimeout(room.roundTimer);
      room.roundTimer = setTimeout(() => {
        endRound(io, room, "timeout");
      }, room.settings.roundDurationMs);
    });

    socket.on("drawing:stroke", (segment) => {
      const code = socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return;
      if (room.status !== "playing") return;
      if (socket.id !== room.currentDrawerId) return;

      // Relay to everyone else in the room as-is; the drawer already
      // rendered it locally. `segment` is { from: {x,y}, to: {x,y}, color, size }
      // with x/y as 0..1 fractions of canvas size (resolution-independent).
      socket.to(room.code).emit("drawing:stroke", segment);
    });

    socket.on("drawing:clear", () => {
      const code = socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return;
      if (room.status !== "playing") return;
      if (socket.id !== room.currentDrawerId) return;

      socket.to(room.code).emit("drawing:clear");
    });

    socket.on("guess:submit", ({ text } = {}) => {
      const code = socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return;
      if (room.status !== "playing") return;
      if (socket.id === room.currentDrawerId) return; // drawer can't guess
      if (room.correctGuessers.has(socket.id)) return; // no spamming after a correct guess

      const player = room.players.get(socket.id);
      if (!player) return;

      const guess = typeof text === "string" ? text.trim() : "";
      if (!guess) return;

      const isCorrect = guess.toLowerCase() === room.currentWord?.toLowerCase();

      if (isCorrect) {
        room.correctGuessers.add(socket.id);

        const elapsed = Date.now() - (room.roundStartedAt ?? Date.now());
        const timeFraction = Math.max(0, 1 - elapsed / room.settings.roundDurationMs);
        const guesserPoints = Math.max(
          GUESSER_MIN_POINTS,
          Math.round(GUESSER_MAX_POINTS * timeFraction)
        );
        player.score += guesserPoints;

        const drawer = room.players.get(room.currentDrawerId);
        if (drawer) {
          drawer.score += DRAWER_POINTS_PER_CORRECT_GUESS;
        }

        socket.emit("chat:message", {
          type: "correct-self",
          text: `You guessed it! +${guesserPoints} points. The word was "${room.currentWord}".`,
          points: guesserPoints,
        });

        socket.to(room.code).emit("chat:message", {
          type: "correct-other",
          text: `${player.name} guessed the word! (+${guesserPoints})`,
          points: guesserPoints,
          playerId: socket.id,
          name: player.name,
        });

        io.to(room.code).emit("room:players", listPlayers(room));

        const eligibleGuessers = room.players.size - 1; // everyone except the drawer
        if (eligibleGuessers > 0 && room.correctGuessers.size >= eligibleGuessers) {
          endRound(io, room, "all-correct");
        }
      } else {
        io.to(room.code).emit("chat:message", {
          type: "guess",
          playerId: socket.id,
          name: player.name,
          text: guess,
        });
      }
    });

    // TODO: round rotation (next drawer) + game:over after N rounds

    socket.on("disconnect", () => {
      const code = socket.data.roomCode;
      if (!code) return;

      const room = getRoom(code);
      if (!room) return;

      const wasCurrentDrawer = socket.id === room.currentDrawerId;
      const wasMidTurn = room.status === "playing" || room.status === "choosing";

      removePlayer(room, socket.id);

      if (isRoomEmpty(room)) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        if (room.roundEndTimer) clearTimeout(room.roundEndTimer);
        deleteRoom(code);
        console.log(`[disconnect] ${socket.id} (room ${code}, now empty)`);
        return;
      }

      io.to(code).emit("room:players", listPlayers(room));

      const gameInProgress =
        room.status === "playing" || room.status === "choosing" || room.status === "round-end";

      if (gameInProgress && room.players.size < 2) {
        // Not enough players left to continue a game — end it cleanly.
        if (room.roundTimer) clearTimeout(room.roundTimer);
        if (room.roundEndTimer) clearTimeout(room.roundEndTimer);
        room.roundTimer = null;
        room.roundEndTimer = null;
        endGame(io, room);
      } else if (wasCurrentDrawer && wasMidTurn) {
        // The drawer left before/during their turn — move the game along
        // rather than waiting out a full round timer with nobody drawing.
        if (room.status === "choosing") {
          advanceRound(io, room);
        } else {
          endRound(io, room, "drawer-left");
        }
      }

      console.log(`[disconnect] ${socket.id} (room ${code})`);
    });
  });
}

// Puts the room into the "choosing" phase: the drawer gets 3 word options
// privately, everyone else is told who's drawing (but not the options).
function beginWordChoice(io, room, drawerId) {
  room.status = "choosing";
  room.currentDrawerId = drawerId;
  room.currentWord = null;
  room.correctGuessers = new Set();
  const choices = getRandomWords(3).map((w) => w.word);
  room.wordChoices = choices;

  io.to(room.code).emit("round:choosing", {
    round: room.round,
    drawerId,
  });

  io.to(drawerId).emit("word:choices", { choices });
}

// Ends the current drawing round (timeout or everyone guessed correctly),
// clearing any pending timer and telling the room what the word was. After
// a short delay (so players can read the reveal), advances to the next turn.
function endRound(io, room, reason) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  room.status = "round-end";

  io.to(room.code).emit("round:end", {
    reason,
    word: room.currentWord,
    players: listPlayers(room),
  });

  if (room.roundEndTimer) clearTimeout(room.roundEndTimer);
  room.roundEndTimer = setTimeout(() => {
    room.roundEndTimer = null;
    advanceRound(io, room);
  }, ROUND_END_DELAY_MS);
}

// Moves to the next drawer's turn, or ends the game once every player has
// had their allotted number of turns (room.settings.roundsPerPlayer).
function advanceRound(io, room) {
  room.turnNumber += 1;

  if (room.turnNumber > room.totalTurns) {
    endGame(io, room);
    return;
  }

  const nextDrawerId = room.drawerOrder[(room.turnNumber - 1) % room.drawerOrder.length];

  // If the next drawer disconnected mid-game, skip their turn rather than
  // stalling the game. (Reassigning drawerOrder on disconnect is a further
  // edge-case improvement — see README status list.)
  if (!room.players.has(nextDrawerId)) {
    advanceRound(io, room);
    return;
  }

  room.round = room.turnNumber;
  beginWordChoice(io, room, nextDrawerId);
}

function endGame(io, room) {
  room.status = "game-over";
  io.to(room.code).emit("game:over", { players: listPlayers(room) });
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Summarizes in-progress game state so a (re)joining client can jump
// straight to the right screen instead of always landing in the lobby.
// Never includes the actual word — that stays private to the drawer.
function buildGameState(room) {
  if (room.status === "lobby") return null;

  return {
    status: room.status,
    round: room.round,
    drawerId: room.currentDrawerId,
    wordLength: room.currentWord ? room.currentWord.length : null,
    roundEndsAt: room.roundStartedAt ? room.roundStartedAt + room.settings.roundDurationMs : null,
  };
}
