import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";
import { clearCanvas, drawSegment, getRelativePoint } from "../drawing.js";

const COLOR_PALETTE = [
  "#1a1a1a", // black
  "#e03131", // red
  "#2f9e44", // green
  "#1971c2", // blue
  "#f08c00", // orange
  "#ae3ec9", // purple
  "#ffffff", // white (eraser-ish, since canvas bg is white)
];

const BRUSH_SIZES = [
  { label: "S", value: 2 },
  { label: "M", value: 4 },
  { label: "L", value: 8 },
  { label: "XL", value: 14 },
];

const DEFAULT_COLOR = COLOR_PALETTE[0];
const DEFAULT_SIZE = BRUSH_SIZES[1].value;

export default function Game({ room, player, players, round, myWord, roundEnd }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [guessText, setGuessText] = useState("");
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [strokeSize, setStrokeSize] = useState(DEFAULT_SIZE);

  const isDrawer = round?.drawerId === player?.id;
  const drawerName = players?.find((p) => p.id === round?.drawerId)?.name;

  // Local countdown derived from the server-provided end timestamp — no need
  // for the server to push a tick every second.
  useEffect(() => {
    if (!round?.roundEndsAt) {
      setSecondsLeft(null);
      return;
    }

    function tick() {
      const remainingMs = round.roundEndsAt - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [round?.roundEndsAt]);

  // Set up the canvas context once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;
    clearCanvas(ctx, canvas);
  }, []);

  // Clear the board + reset per-round guess state at the start of every new round.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    clearCanvas(ctx, canvas);
    setHasGuessedCorrectly(false);
  }, [round?.round]);

  // Chat / guess messages.
  useEffect(() => {
    function handleChatMessage(message) {
      setMessages((prev) => [...prev, { ...message, id: `${Date.now()}-${Math.random()}` }]);
      if (message.type === "correct-self") {
        setHasGuessedCorrectly(true);
      }
    }

    socket.on("chat:message", handleChatMessage);
    return () => socket.off("chat:message", handleChatMessage);
  }, []);

  // Render strokes broadcast by the drawer.
  useEffect(() => {
    function handleRemoteStroke(segment) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      drawSegment(ctx, canvas, segment.from, segment.to, segment);
    }

    function handleRemoteClear() {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      clearCanvas(ctx, canvas);
    }

    socket.on("drawing:stroke", handleRemoteStroke);
    socket.on("drawing:clear", handleRemoteClear);
    return () => {
      socket.off("drawing:stroke", handleRemoteStroke);
      socket.off("drawing:clear", handleRemoteClear);
    };
  }, []);

  function handlePointerDown(e) {
    if (!isDrawer || roundEnd) return;
    isDrawingRef.current = true;
    lastPointRef.current = getRelativePoint(canvasRef.current, e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    if (!isDrawer || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const point = getRelativePoint(canvas, e.clientX, e.clientY);
    const from = lastPointRef.current;
    const segment = { from, to: point, color: strokeColor, size: strokeSize };

    drawSegment(ctxRef.current, canvas, from, point, segment);
    socket.emit("drawing:stroke", segment);
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }

  function handleClear() {
    if (!isDrawer) return;
    clearCanvas(ctxRef.current, canvasRef.current);
    socket.emit("drawing:clear");
  }

  function handleGuessSubmit(e) {
    e.preventDefault();
    const text = guessText.trim();
    if (!text) return;
    socket.emit("guess:submit", { text });
    setGuessText("");
  }

  const canGuess = !isDrawer && !hasGuessedCorrectly && !roundEnd;

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
        <span>Time: {secondsLeft ?? "--"}</span>
      </header>

      {roundEnd && (
        <div className="round-end-banner">
          Round over (
          {roundEnd.reason === "timeout"
            ? "time's up!"
            : roundEnd.reason === "drawer-left"
            ? "the drawer left"
            : "everyone guessed it!"}
          ) — the word was <strong>{roundEnd.word}</strong>.
        </div>
      )}

      <div className="game-body">
        <div className="canvas-wrap">
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

          {isDrawer && (
            <div className="toolbar">
              <div className="color-palette">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${color === strokeColor ? " active" : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                    onClick={() => setStrokeColor(color)}
                  />
                ))}
              </div>

              <div className="brush-sizes">
                {BRUSH_SIZES.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    className={`brush-size-btn${value === strokeSize ? " active" : ""}`}
                    onClick={() => setStrokeSize(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button type="button" className="clear-btn" onClick={handleClear}>
                Clear canvas
              </button>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="players">
            <ul className="leaderboard">
              {[...(players ?? [])]
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.name}
                      {p.id === round?.drawerId ? " ✏️" : ""}
                      {p.id === player?.id ? " (you)" : ""}
                    </span>
                    <strong>{p.score}</strong>
                  </li>
                ))}
            </ul>
          </div>

          <div className="chat">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message chat-${m.type}`}>
                {m.type === "guess" ? (
                  <>
                    <strong>{m.name}:</strong> {m.text}
                  </>
                ) : (
                  m.text
                )}
              </div>
            ))}
          </div>

          <form className="guess-form" onSubmit={handleGuessSubmit}>
            <input
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              placeholder={
                isDrawer
                  ? "You're drawing — no guessing!"
                  : hasGuessedCorrectly
                  ? "You already got it!"
                  : "Type your guess..."
              }
              disabled={!canGuess}
            />
          </form>
        </aside>
      </div>
    </div>
  );
}
