// Final results screen shown once every player has had their turn(s) to draw.
export default function GameOver({ players }) {
  const sorted = [...(players ?? [])].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  function playAgain() {
    window.location.reload();
  }

  return (
    <div className="game-over">
      <h1>Game over!</h1>
      {winner && (
        <p className="winner">
          🏆 {winner.name} wins with {winner.score} points!
        </p>
      )}

      <ol className="final-leaderboard">
        {sorted.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <strong>{p.score}</strong>
          </li>
        ))}
      </ol>

      <button onClick={playAgain}>Play again</button>
    </div>
  );
}
