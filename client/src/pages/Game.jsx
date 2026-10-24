import { useEffect, useRef } from "react";

// Main game screen shell: canvas (drawing surface) + sidebar (players/chat).
// Drawing sync, guessing, scoring, and round/timer logic get wired in next.
export default function Game({ room, player, players, round, myWord }) {
  const canvasRef = useRef(null);
  const isDrawer = round?.drawerId === player?.id;
  const drawerName = players?.find((p) => p.id === round?.drawerId)?.name;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // TODO: pointer event handlers -> emit('drawing:stroke', ...)
    // TODO: socket.on('drawing:stroke', ...) to render remote strokes
  }, []);

  return (
    <div className="game">
      <header>
        <span>Room: {room}</span>
        <span>
          {isDrawer
            ? `Your word: ${myWord ?? "..."}`
            : `${drawerName ?? "Someone"} is drawing — ${"_ ".repeat(
                round?.wordLength ?? 0
              )}`}
        </span>
        <span>Time: --</span>
      </header>

      <div className="game-body">
        <canvas ref={canvasRef} width={800} height={600} />

        <aside className="sidebar">
          <div className="players">{/* TODO: player list + scores */}</div>
          <div className="chat">{/* TODO: guesses / system messages */}</div>
          <form className="guess-form">
            <input placeholder="Type your guess..." disabled />
          </form>
        </aside>
      </div>
    </div>
  );
}
