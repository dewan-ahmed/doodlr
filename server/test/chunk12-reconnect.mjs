// Verifies reconnect support:
// 1. A disconnected player rejoining with the same clientId gets their score back.
// 2. The join response's gameState lets a reconnecting client resume mid-round
//    (without ever leaking the actual word).
// 3. clientId is never broadcast in room:players (would let others steal scores).
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

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function onceAll(sockets, event) {
  return Promise.all(sockets.map((s) => once(s, event)));
}

async function main() {
  const alice = io(URL);
  const bob = io(URL);
  const carol = io(URL);
  const sockets = [alice, bob, carol];
  await Promise.all(sockets.map((s) => new Promise((resolve) => s.on("connect", resolve))));

  const createRes = await new Promise((resolve) =>
    alice.emit("room:create", { name: "Alice", clientId: "c-alice" }, resolve)
  );
  const roomCode = createRes.room;

  await new Promise((resolve) => bob.emit("room:join", { code: roomCode, name: "Bob", clientId: "c-bob" }, resolve));
  await new Promise((resolve) =>
    carol.emit("room:join", { code: roomCode, name: "Carol", clientId: "c-carol" }, resolve)
  );

  // clientId must never show up in a broadcast player list.
  const playersBroadcast = await new Promise((resolve) => carol.once("room:players", resolve));
  assert(
    playersBroadcast.every((p) => !("clientId" in p)),
    "room:players broadcast never includes clientId"
  );

  const choosing = onceAll(sockets, "round:choosing");
  alice.emit("game:start");
  const [choosingPayload] = await choosing;

  const drawer = sockets.find((s) => s.id === choosingPayload.drawerId);
  const { choices } = await once(drawer, "word:choices");

  const roundStart = onceAll(sockets, "round:start");
  drawer.emit("word:choose", { word: choices[0] });
  const [roundStartPayload] = await roundStart;

  // Pick a non-drawer to be our "victim" who guesses correctly, then disconnects.
  const victim = sockets.find((s) => s !== drawer);
  const victimClientId = victim === alice ? "c-alice" : victim === bob ? "c-bob" : "c-carol";
  const victimName = victim === alice ? "Alice" : victim === bob ? "Bob" : "Carol";

  const leaderboardUpdate = new Promise((resolve) => drawer.once("room:players", resolve));
  victim.emit("guess:submit", { text: choices[0] });
  const leaderboard = await leaderboardUpdate;
  const victimScoreBeforeDisconnect = leaderboard.find((p) => p.name === victimName).score;
  assert(victimScoreBeforeDisconnect > 0, "victim earned points before disconnecting");

  victim.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 150)); // let the server process the disconnect

  // Reconnect with a brand-new socket but the SAME clientId.
  const victimReconnect = io(URL);
  await new Promise((resolve) => victimReconnect.on("connect", resolve));

  const rejoinRes = await new Promise((resolve) =>
    victimReconnect.emit("room:join", { code: roomCode, name: victimName, clientId: victimClientId }, resolve)
  );

  assert(!rejoinRes.error, "reconnecting player can rejoin the same room");
  assert(rejoinRes.player.score === victimScoreBeforeDisconnect, "reconnecting player's score is restored, not reset to 0");
  assert(rejoinRes.gameState?.status === "playing", "gameState reflects that a round is in progress");
  assert(rejoinRes.gameState?.drawerId === roundStartPayload.drawerId, "gameState reports the correct current drawer");
  assert(rejoinRes.gameState?.wordLength === choices[0].length, "gameState reports the correct word length");
  assert(!("word" in rejoinRes.gameState), "gameState never includes the actual word");

  alice.close();
  bob.close();
  carol.close();
  victimReconnect.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
