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

      const players = listPlayers(room);
      if (players.length < 2) return;

      room.round = 1;
      beginWordChoice(io, room, players[0].id);
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

      io.to(room.code).emit("round:start", {
        round: room.round,
        drawerId: room.currentDrawerId,
        wordLength: word.length,
      });
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

    // TODO: drawing:clear, guess:submit, round:end, game:over

    socket.on("disconnect", () => {
      const code = socket.data.roomCode;
      if (!code) return;

      const room = getRoom(code);
      if (!room) return;

      removePlayer(room, socket.id);

      if (isRoomEmpty(room)) {
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
  const choices = getRandomWords(3).map((w) => w.word);
  room.wordChoices = choices;

  io.to(room.code).emit("round:choosing", {
    round: room.round,
    drawerId,
  });

  io.to(drawerId).emit("word:choices", { choices });
}
