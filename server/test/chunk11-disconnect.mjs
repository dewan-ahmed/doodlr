// Verifies disconnect edge cases:
// 1. With 3 players, the drawer disconnecting mid-round ends that round
//    (reason: "drawer-left") and the game continues with the 2 remaining players.
// 2. With only 2 players, the drawer disconnecting ends the whole game
//    immediately (not enough players left to continue).
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

async function createRoomWithPlayers(names) {
  const sockets = names.map(() => io(URL));
  await Promise.all(sockets.map((s) => new Promise((resolve) => s.on("connect", resolve))));

  const [host, ...rest] = sockets;
  const createRes = await new Promise((resolve) => host.emit("room:create", { name: names[0] }, resolve));
  for (let i = 0; i < rest.length; i++) {
    await new Promise((resolve) => rest[i].emit("room:join", { code: createRes.room, name: names[i + 1] }, resolve));
  }
  return { sockets, roomCode: createRes.room };
}

async function startFirstRound(sockets) {
  const choosing = onceAll(sockets, "round:choosing");
  sockets[0].emit("game:start");
  const [choosingPayload] = await choosing;

  const drawer = sockets.find((s) => s.id === choosingPayload.drawerId);
  const choicesPromise = once(drawer, "word:choices");
  const { choices } = await choicesPromise;

  const roundStart = onceAll(sockets, "round:start");
  drawer.emit("word:choose", { word: choices[0] });
  await roundStart;

  return { drawer, choices };
}

async function testDrawerLeftWithEnoughPlayersRemaining() {
  const { sockets } = await createRoomWithPlayers(["Alice", "Bob", "Carol"]);
  const { drawer } = await startFirstRound(sockets);

  const remaining = sockets.filter((s) => s !== drawer);
  const roundEnds = onceAll(remaining, "round:end");

  drawer.disconnect();

  const [roundEndPayload] = await roundEnds;
  assert(roundEndPayload.reason === "drawer-left", "remaining players get round:end with reason 'drawer-left'");

  // Game should continue: a new round:choosing should still arrive for one of the 2 remaining players.
  const nextChoosing = onceAll(remaining, "round:choosing");
  const [nextChoosingPayload] = await Promise.race([
    nextChoosing.then((r) => [r]),
    new Promise((resolve) => setTimeout(() => resolve([null]), 6000)),
  ]);

  assert(!!nextChoosingPayload, "game continues with a new round:choosing after the drawer-left round ends");

  remaining.forEach((s) => s.close());
}

async function testDrawerLeftWithTooFewPlayers() {
  const { sockets } = await createRoomWithPlayers(["Dan", "Eve"]);
  const { drawer } = await startFirstRound(sockets);

  const remaining = sockets.filter((s) => s !== drawer);
  const gameOvers = onceAll(remaining, "game:over");

  drawer.disconnect();

  const [gameOverPayload] = await gameOvers;
  assert(gameOverPayload.players.length === 1, "game ends immediately when only 1 player remains");

  remaining.forEach((s) => s.close());
}

async function main() {
  await testDrawerLeftWithEnoughPlayersRemaining();
  await testDrawerLeftWithTooFewPlayers();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
