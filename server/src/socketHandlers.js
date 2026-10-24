import {
  addPlayer,
  createRoom,
  deleteRoom,
  getRoom,
  isRoomEmpty,
  listPlayers,
  removePlayer,
} from "./rooms.js";

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

    // TODO: drawing:stroke, drawing:clear, guess:submit, round:start, round:end, game:start, game:over

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
