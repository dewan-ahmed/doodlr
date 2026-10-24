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
  ROUND_DURATION_MS,
  ROUND_END_DELAY_MS,
  ROUNDS_PER_PLAYER,
} from "./constants.js";

// Socket.io event skeleton. Game-specific events (drawing strokes, guesses,
// scoring, round timer, etc.) get added here as we build them out.
export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);

    socket.on("room:create", ({ name }, callback) => {
      const room = createRoom();
      const player = addPlayer(room, socket.id, name);

      socket.join(room.code);
      socket.data.roomCode = room.code;

      callback?.({ room: room.code, player, players: listPlayers(room) });
      io.to(room.code).emit("room:players", listPlayers(room));
    });

    socket.on("room:join", ({ code, name }, callback) => {
      const room = getRoom(code?.toUpperCase());
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      const player = addPlayer(room, socket.id, name);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      callback?.({ room: room.code, player, players: listPlayers(room) });
      io.to(room.code).emit("room:players", listPlayers(room));
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
      room.totalTurns = room.drawerOrder.length * ROUNDS_PER_PLAYER;
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
        roundEndsAt: room.roundStartedAt + ROUND_DURATION_MS,
      });

      if (room.roundTimer) clearTimeout(room.roundTimer);
      room.roundTimer = setTimeout(() => {
        endRound(io, room, "timeout");
      }, ROUND_DURATION_MS);
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
        const timeFraction = Math.max(0, 1 - elapsed / ROUND_DURATION_MS);
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
        });

        socket.to(room.code).emit("chat:message", {
          type: "correct-other",
          text: `${player.name} guessed the word! (+${guesserPoints})`,
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

      removePlayer(room, socket.id);

      if (isRoomEmpty(room)) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        if (room.roundEndTimer) clearTimeout(room.roundEndTimer);
        deleteRoom(code);
      } else {
        io.to(code).emit("room:players", listPlayers(room));
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
// had their allotted number of turns (ROUNDS_PER_PLAYER).
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
