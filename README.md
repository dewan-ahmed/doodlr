# Custom Scribble-style Game

A Scribbl.io-inspired drawing & guessing game, built from scratch.

## Structure

- `server/` — Node + Express + Socket.io backend (in-memory rooms, real-time events)
- `client/` — React (Vite) frontend: join screen + game screen (canvas + chat sidebar)

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

## Status

Scaffold only — project structure, room create/join plumbing, and placeholder
screens are in place. Not yet implemented:

- [ ] Drawing canvas sync (pointer events -> socket -> remote render)
- [ ] Word selection + "it's your turn to draw" flow
- [ ] Guess submission + correct-guess detection
- [ ] Scoring (speed-based) + live leaderboard
- [ ] Round timer + rotation through players
- [ ] Game over screen
