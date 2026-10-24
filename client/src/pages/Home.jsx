import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import { getClientId, getRoomCodeFromUrl } from "../session.js";

// Join / create room screen.
export default function Home({ onJoined }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState(getRoomCodeFromUrl());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // If someone opens an invite link (?room=CODE), the join form comes
  // pre-filled so they just need to type their name and hit Join.
  useEffect(() => {
    const prefilled = getRoomCodeFromUrl();
    if (prefilled) setRoomCode(prefilled);
  }, []);

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
    socket.emit("room:create", { name, clientId: getClientId() }, (res) => {
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
    socket.emit("room:join", { code: roomCode, name, clientId: getClientId() }, (res) => {
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
