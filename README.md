# Custom Scribble-style Game

A Scribbl.io-inspired drawing & guessing game, built from scratch.

## Structure

- `server/` — Node + Express + Socket.io backend (in-memory rooms, real-time events)
- `client/` — React (Vite) frontend: Home -> Lobby -> Word Choice -> Game -> Game Over

## Running locally

In one terminal:

```bash
cd server
npm install
npm run dev
```

In another terminal:

```bash
cd client
npm install
npm run dev
```

Client runs on http://localhost:5173, server on http://localhost:3001.

To play with others on the same network, set `VITE_SERVER_URL` for the client
to point at your machine's LAN IP instead of localhost.

## How it plays

1. One player creates a room and shares the 5-letter code (or an invite link).
2. In the lobby, the host can tweak rounds-per-player and round length before
   starting; once 2+ players have joined, the host starts the game.
3. Each turn, the drawer picks 1 of 3 words and draws it on the canvas while
   everyone else guesses in the chat.
4. Correct guesses award points based on speed; the drawer also earns points
   per correct guess.
5. A round ends when everyone's guessed or the timer runs out, then rotates
   to the next drawer. After everyone's had their turn(s), the game ends with
   a final leaderboard.
6. If someone's connection drops mid-game, refreshing and rejoining the same
   room restores their score and place in the game.

## Status: playable MVP

All core gameplay loops are implemented and covered by integration tests in
`server/test/*.mjs` (simulated multi-client socket.io sessions):

- [x] Room create/join + lobby
- [x] Word-choice flow (drawer picks 1 of 3)
- [x] Real-time drawing canvas sync + clear
- [x] Guess chat with correctness detection (word never leaked to others)
- [x] Speed-based scoring + live leaderboard
- [x] Round timer + auto-end (timeout or everyone-correct)
- [x] Round rotation across all players, game-over screen
- [x] Disconnect handling (drawer leaving mid-round, empty-room cleanup)
- [x] Reconnect/resume support (refresh keeps your score and place in-game)
- [x] Host-configurable rounds-per-player and round length, set pre-game
- [x] Sound + visual feedback for correct guesses and round end (mutable)

### Known limitations / ideas for next time

- No persistence — rooms are in-memory and die with the server process.
- No mobile-specific touch polish beyond basic pointer events.
- Reconnect grace period is fixed (`RECONNECT_GRACE_MS`) and not host-configurable.

## Testing

Server logic is covered by small Socket.io-client simulation scripts in
`server/test/`. Run the dev server, then run any test file directly, e.g.:

```bash
cd server
npm run dev &
node test/chunk6-guess-chat.mjs
```

Some tests (timer/rotation-related) read `ROUND_DURATION_MS`,
`ROUND_END_DELAY_MS`, and `ROUNDS_PER_PLAYER` env vars so they can run fast
instead of waiting out the real (80s) round length — see each test file's
header comment for the exact invocation used.
