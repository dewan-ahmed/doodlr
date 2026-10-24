import { useState } from "react";
import { socket } from "../socket.js";

function getInviteLink(room) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  return url.toString();
}

// Waiting room shown after joining/creating, before the game starts.
export default function Lobby({ room, player, players }) {
  const isHost = player?.isHost;
  const canStart = players.length >= 2;
  const [copied, setCopied] = useState(false);

  function handleStart() {
    socket.emit("game:start");
  }

  async function handleCopyInvite() {
    const link = getInviteLink(room);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (e.g. insecure context) — fall back to a prompt.
      window.prompt("Copy this invite link:", link);
    }
  }

  return (
    <div className="lobby">
      <h1>Room {room}</h1>
      <p>Share this code with your colleagues to have them join.</p>

      <button type="button" className="invite-btn" onClick={handleCopyInvite}>
        {copied ? "Link copied!" : "Copy invite link"}
      </button>

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
