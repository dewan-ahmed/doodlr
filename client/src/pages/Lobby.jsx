import { socket } from "../socket.js";

// Waiting room shown after joining/creating, before the game starts.
export default function Lobby({ room, player, players }) {
  const isHost = player?.isHost;
  const canStart = players.length >= 2;

  function handleStart() {
    socket.emit("game:start");
  }

  return (
    <div className="lobby">
      <h1>Room {room}</h1>
      <p>Share this code with your colleagues to have them join.</p>

      <h2>Players ({players.length})</h2>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.isHost ? " (host)" : ""}
            {p.id === player?.id ? " — you" : ""}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button onClick={handleStart} disabled={!canStart}>
          {canStart ? "Start game" : "Need at least 2 players"}
        </button>
      ) : (
        <p>Waiting for the host to start the game...</p>
      )}
    </div>
  );
}
