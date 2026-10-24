import { useState } from "react";

// Join / create room screen. Wires up to room:create and room:join once we
// build out the socket logic together — for now it's a plain form shell.
export default function Home({ onJoined }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  function handleCreate(e) {
    e.preventDefault();
    // TODO: socket.emit('room:create', { name }, callback)
    console.log("create room", { name });
  }

  function handleJoin(e) {
    e.preventDefault();
    // TODO: socket.emit('room:join', { code: roomCode, name }, callback)
    console.log("join room", { name, roomCode });
  }

  return (
    <div className="home">
      <h1>Scribble (Custom)</h1>

      <label>
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dewan"
        />
      </label>

      <form onSubmit={handleCreate}>
        <button type="submit" disabled={!name}>
          Create new room
        </button>
      </form>

      <form onSubmit={handleJoin}>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="Room code"
          maxLength={5}
        />
        <button type="submit" disabled={!name || !roomCode}>
          Join room
        </button>
      </form>
    </div>
  );
}
