// Verifies scoring: a correct guess awards points to both guesser and
// drawer, and an updated room:players leaderboard is broadcast.
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

  const hostChoices = new Promise((resolve) => host.once("word:choices", resolve));
  host.emit("game:start");
  const { choices } = await hostChoices;

  const hostRoundStart = new Promise((resolve) => host.once("round:start", resolve));
  host.emit("word:choose", { word: choices[0] });
  await hostRoundStart;

  return { host, guest, word: choices[0] };
}

async function main() {
  const { host, guest, word } = await setupPlayingRoom();

  const hostLeaderboardUpdate = new Promise((resolve) => host.once("room:players", resolve));
  const guestLeaderboardUpdate = new Promise((resolve) => guest.once("room:players", resolve));

  guest.emit("guess:submit", { text: word });

  const [hostPlayers, guestPlayers] = await Promise.all([hostLeaderboardUpdate, guestLeaderboardUpdate]);

  const hostFromHostList = hostPlayers.find((p) => p.name === "Alice");
  const guestFromHostList = hostPlayers.find((p) => p.name === "Bob");

  assert(guestFromHostList.score > 0, "guesser (Bob) got positive points");
  assert(hostFromHostList.score === 20, "drawer (Alice) got the fixed drawer bonus (20)");
  assert(
    JSON.stringify(hostPlayers) === JSON.stringify(guestPlayers),
    "both clients receive the identical updated leaderboard"
  );

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
