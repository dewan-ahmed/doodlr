// Verifies scoring: a correct guess awards points to both guesser and
// drawer, an updated room:players leaderboard is broadcast, and the
// correct-self/correct-other chat:message payloads include the exact
// points awarded (used by the client for sound/visual feedback).
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

async function setupPlayingRoom() {
  const host = io(URL);
  const guest = io(URL);

  await new Promise((resolve) => host.on("connect", resolve));
  await new Promise((resolve) => guest.on("connect", resolve));

  const createRes = await new Promise((resolve) =>
    host.emit("room:create", { name: "Alice" }, resolve)
  );
  await new Promise((resolve) =>
    guest.emit("room:join", { code: createRes.room, name: "Bob" }, resolve)
  );

  // Drawer order is shuffled each game, so figure out who's actually
  // drawing instead of assuming it's always the host.
  const hostChoosing = new Promise((resolve) => host.once("round:choosing", resolve));
  const hostChoicesPromise = new Promise((resolve) => host.once("word:choices", resolve));
  const guestChoicesPromise = new Promise((resolve) => guest.once("word:choices", resolve));
  host.emit("game:start");

  const { drawerId } = await hostChoosing;
  const drawer = drawerId === host.id ? host : guest;
  const guesser = drawer === host ? guest : host;
  const { choices } = await (drawer === host ? hostChoicesPromise : guestChoicesPromise);

  const roundStart = new Promise((resolve) => drawer.once("round:start", resolve));
  drawer.emit("word:choose", { word: choices[0] });
  await roundStart;

  return { drawer, guesser, word: choices[0] };
}

async function main() {
  const { drawer, guesser, word } = await setupPlayingRoom();

  const drawerLeaderboardUpdate = new Promise((resolve) => drawer.once("room:players", resolve));
  const guesserLeaderboardUpdate = new Promise((resolve) => guesser.once("room:players", resolve));
  const correctSelf = new Promise((resolve) => guesser.once("chat:message", resolve));
  const correctOther = new Promise((resolve) => drawer.once("chat:message", resolve));

  guesser.emit("guess:submit", { text: word });

  const [drawerPlayers, guesserPlayers] = await Promise.all([
    drawerLeaderboardUpdate,
    guesserLeaderboardUpdate,
  ]);

  const drawerFromList = drawerPlayers.find((p) => p.id === drawer.id);
  const guesserFromList = drawerPlayers.find((p) => p.id === guesser.id);

  assert(guesserFromList.score > 0, "guesser got positive points");
  assert(drawerFromList.score === 20, "drawer got the fixed drawer bonus (20)");
  assert(
    JSON.stringify(drawerPlayers) === JSON.stringify(guesserPlayers),
    "both clients receive the identical updated leaderboard"
  );

  const correctSelfMsg = await correctSelf;
  const correctOtherMsg = await correctOther;
  assert(
    correctSelfMsg.type === "correct-self" && correctSelfMsg.points === guesserFromList.score,
    "the guesser's own chat:message includes the exact points they earned"
  );
  assert(
    correctOtherMsg.type === "correct-other" &&
      correctOtherMsg.points === guesserFromList.score &&
      correctOtherMsg.playerId === guesser.id,
    "everyone else's chat:message includes the same points and the guesser's playerId"
  );

  drawer.close();
  guesser.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
