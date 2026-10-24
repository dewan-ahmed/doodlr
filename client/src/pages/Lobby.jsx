import { useState } from "react";
import { socket } from "../socket.js";

function getInviteLink(room) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  return url.toString();
}

const ROUND_DURATION_OPTIONS_SEC = [30, 60, 90, 120, 180];
const ROUNDS_PER_PLAYER_OPTIONS = [1, 2, 3, 4, 5];

// Waiting room shown after joining/creating, before the game starts.
export default function Lobby({ room, player, players, settings }) {
  const isHost = player?.isHost;
  const canStart = players.length >= 2;
  const [copied, setCopied] = useState(false);

  function handleStart() {
    socket.emit("game:start");
  }

  function handleRoundsChange(e) {
    socket.emit("room:settings:update", { roundsPerPlayer: Number(e.target.value) });
  }

  function handleDurationChange(e) {
    socket.emit("room:settings:update", { roundDurationMs: Number(e.target.value) * 1000 });
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

      <div className="game-settings">
        <h2>Game settings</h2>
        {isHost ? (
          <div className="game-settings-controls">
            <label>
              Rounds per player
              <select value={settings?.roundsPerPlayer ?? 2} onChange={handleRoundsChange}>
                {ROUNDS_PER_PLAYER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Round length
              <select
                value={Math.round((settings?.roundDurationMs ?? 80_000) / 1000)}
                onChange={handleDurationChange}
              >
                {ROUND_DURATION_OPTIONS_SEC.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}s
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p>
            {settings?.roundsPerPlayer ?? 2} rounds per player &middot;{" "}
            {Math.round((settings?.roundDurationMs ?? 80_000) / 1000)}s per round
          </p>
        )}
      </div>

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
