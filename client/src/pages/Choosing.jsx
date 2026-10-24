import { socket } from "../socket.js";

// Shown between the lobby and the drawing canvas while the drawer picks
// a word. Non-drawers just see a waiting message.
export default function Choosing({ isDrawer, drawerName, choices, onChoose }) {
  function choose(word) {
    socket.emit("word:choose", { word });
    onChoose?.(word);
  }

  if (!isDrawer) {
    return (
      <div className="choosing">
        <h2>{drawerName ?? "Someone"} is choosing a word...</h2>
      </div>
    );
  }

  return (
    <div className="choosing">
      <h2>Pick a word to draw</h2>
      <div className="choices">
        {(choices ?? []).map((word) => (
          <button key={word} onClick={() => choose(word)}>
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
