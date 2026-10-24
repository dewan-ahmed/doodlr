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

      room.status = "playing";
      room.round = 1;
      startRound(io, room, players[0].id);
    });

    // TODO: drawing:stroke, drawing:clear, guess:submit, round:end, game:over

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

// Minimal round-start: auto-assigns a random word to the drawer and tells
// everyone else who's drawing. Word-choice UI (pick 1 of 3) lands in a later
// chunk — this just gets the lobby -> game transition working end to end.
function startRound(io, room, drawerId) {
  room.currentDrawerId = drawerId;
  const [{ word }] = getRandomWords(1);
  room.currentWord = word;

  io.to(room.code).emit("round:start", {
    round: room.round,
    drawerId,
    wordLength: word.length,
  });

  io.to(drawerId).emit("word:assigned", { word });
}
