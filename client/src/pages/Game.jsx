import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";
import { clearCanvas, drawSegment, getRelativePoint } from "../drawing.js";

const STROKE_COLOR = "#1a1a1a";
const STROKE_SIZE = 4;

export default function Game({ room, player, players, round, myWord, roundEnd }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [guessText, setGuessText] = useState("");
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);

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
    const segment = { from, to: point, color: STROKE_COLOR, size: STROKE_SIZE };

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
            <button type="button" className="clear-btn" onClick={handleClear}>
              Clear canvas
            </button>
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
