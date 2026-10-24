// Verifies round rotation: after round:end, the NEXT drawer (not the same
// one) gets round:choosing, round numbers increment, and once every player
// has had their turn(s), game:over fires with the final leaderboard.
// Run against a server with short ROUND_END_DELAY_MS / ROUNDS_PER_PLAYER=1
// and 2 players -> exactly 2 total turns.
import { io } from "socket.io-client";

const URL = "http://localhost:3001";
let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

// One-time listener promise for a single socket, registered immediately
// (avoids races where the server emits before we attach a later listener).
function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

// Registers a one-time listener on every socket up front for a BROADCAST
// event (one that every socket in the room will receive).
function onceAll(sockets, event) {
  return Promise.all(sockets.map((s) => once(s, event)));
}

// Registers one-time listeners on every socket for a PRIVATE event (only one
// socket will actually receive it) — returns per-socket promises, not combined.
function onceEach(sockets, event) {
  return sockets.map((s) => once(s, event));
}

async function main() {
  const alice = io(URL);
  const bob = io(URL);
  const sockets = [alice, bob];
  await Promise.all(sockets.map((s) => new Promise((resolve) => s.on("connect", resolve))));

  const createRes = await new Promise((resolve) => alice.emit("room:create", { name: "Alice" }, resolve));
  await new Promise((resolve) => bob.emit("room:join", { code: createRes.room, name: "Bob" }, resolve));

  // --- Turn 1 ---
  const choosing1 = onceAll(sockets, "round:choosing");
  const choices1Both = onceEach(sockets, "word:choices");
  alice.emit("game:start");

  const [choosing1Payload] = await choosing1;
  assert(choosing1Payload.round === 1, "turn 1 is round 1");

  const drawer1Id = choosing1Payload.drawerId;
  const drawerSocket1 = drawer1Id === alice.id ? alice : bob;
  const guesserSocket1 = drawer1Id === alice.id ? bob : alice;
  const drawerIndex1 = drawer1Id === alice.id ? 0 : 1;

  const { choices: choices1 } = await choices1Both[drawerIndex1];

  const roundStart1 = onceAll(sockets, "round:start");
  drawerSocket1.emit("word:choose", { word: choices1[0] });
  await roundStart1;

  // Guesser guesses correctly -> round ends early, then after
  // ROUND_END_DELAY_MS, turn 2 should start automatically with the OTHER player drawing.
  const choosing2 = onceAll(sockets, "round:choosing");
  const choices2Both = onceEach(sockets, "word:choices");
  guesserSocket1.emit("guess:submit", { text: choices1[0] });

  const [choosing2Payload] = await choosing2;
  assert(choosing2Payload.round === 2, "after round 1 ends, round:choosing for round 2 fires automatically");
  assert(choosing2Payload.drawerId === guesserSocket1.id, "the OTHER player (previous guesser) now draws turn 2");

  const drawerSocket2 = guesserSocket1;
  const guesserSocket2 = drawerSocket1;
  const drawerIndex2 = drawerSocket2 === alice ? 0 : 1;

  const { choices: choices2 } = await choices2Both[drawerIndex2];

  const roundStart2 = onceAll(sockets, "round:start");
  drawerSocket2.emit("word:choose", { word: choices2[0] });
  await roundStart2;

  // With ROUNDS_PER_PLAYER=1 and 2 players, this is the last turn — ending it should fire game:over.
  const gameOvers = onceAll(sockets, "game:over");
  guesserSocket2.emit("guess:submit", { text: choices2[0] });
  const [gameOverPayload] = await gameOvers;

  assert(Array.isArray(gameOverPayload.players) && gameOverPayload.players.length === 2, "game:over includes the final 2-player leaderboard");
  assert(gameOverPayload.players.every((p) => p.score > 0), "both players ended the game with positive scores");

  alice.close();
  bob.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
