import { useEffect, useRef } from "react";
import { socket } from "../socket.js";
import { clearCanvas, drawSegment, getRelativePoint } from "../drawing.js";

const STROKE_COLOR = "#1a1a1a";
const STROKE_SIZE = 4;

export default function Game({ room, player, players, round, myWord }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const isDrawer = round?.drawerId === player?.id;
  const drawerName = players?.find((p) => p.id === round?.drawerId)?.name;

  // Set up the canvas context once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;
    clearCanvas(ctx, canvas);
  }, []);

  // Clear the board at the start of every new round.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    clearCanvas(ctx, canvas);
  }, [round?.round]);

  // Render strokes broadcast by the drawer.
  useEffect(() => {
    function handleRemoteStroke(segment) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      drawSegment(ctx, canvas, segment.from, segment.to, segment);
    }

    socket.on("drawing:stroke", handleRemoteStroke);
    return () => socket.off("drawing:stroke", handleRemoteStroke);
  }, []);

  function handlePointerDown(e) {
    if (!isDrawer) return;
    isDrawingRef.current = true;
    lastPointRef.current = getRelativePoint(canvasRef.current, e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    if (!isDrawer || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const point = getRelativePoint(canvas, e.clientX, e.clientY);
    const from = lastPointRef.current;
    const segment = { from, to: point, color: STROKE_COLOR, size: STROKE_SIZE };

    drawSegment(ctxRef.current, canvas, from, point, segment);
    socket.emit("drawing:stroke", segment);
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }

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
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className={isDrawer ? "drawable" : ""}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

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
