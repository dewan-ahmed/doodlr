import { useState } from "react";
import { socket } from "../socket.js";

// Join / create room screen.
export default function Home({ onJoined }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function ensureConnected() {
    if (!socket.connected) {
      socket.connect();
    }
  }

  function handleCreate(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    ensureConnected();
    socket.emit("room:create", { name }, (res) => {
      setPending(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onJoined(res);
    });
  }

  function handleJoin(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    ensureConnected();
    socket.emit("room:join", { code: roomCode, name }, (res) => {
      setPending(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onJoined(res);
    });
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
        <button type="submit" disabled={!name || pending}>
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
        <button type="submit" disabled={!name || !roomCode || pending}>
          Join room
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
