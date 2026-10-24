// Simulates two players joining a room and starting the game, asserting
// that the server emits the right events to the right sockets.
// Run with the dev server already listening on localhost:3001.
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

async function main() {
  const host = io(URL);
  const guest = io(URL);

  await new Promise((resolve) => host.on("connect", resolve));
  await new Promise((resolve) => guest.on("connect", resolve));

  const createRes = await new Promise((resolve) =>
    host.emit("room:create", { name: "Alice" }, resolve)
  );
  assert(!!createRes.room, "host created a room with a code");
  assert(createRes.player.isHost, "host player flagged isHost");

  const joinRes = await new Promise((resolve) =>
    guest.emit("room:join", { code: createRes.room, name: "Bob" }, resolve)
  );
  assert(joinRes.room === createRes.room, "guest joined the same room");
  assert(!joinRes.player.isHost, "guest is not host");
  assert(joinRes.players.length === 2, "room has 2 players after join");

  // Both should receive round:start; only the drawer gets word:assigned.
  const hostRoundStart = new Promise((resolve) => host.once("round:start", resolve));
  const guestRoundStart = new Promise((resolve) => guest.once("round:start", resolve));
  const hostWord = new Promise((resolve) => host.once("word:assigned", resolve));
  let guestGotWord = false;
  guest.once("word:assigned", () => {
    guestGotWord = true;
  });

  host.emit("game:start");

  const [hostPayload, guestPayload] = await Promise.all([hostRoundStart, guestRoundStart]);
  assert(hostPayload.drawerId === host.id, "host (first player) is selected as drawer");
  assert(hostPayload.wordLength > 0, "round:start includes word length");
  assert(guestPayload.drawerId === hostPayload.drawerId, "both clients agree on drawer");

  const wordPayload = await hostWord;
  assert(typeof wordPayload.word === "string" && wordPayload.word.length > 0, "drawer received the actual word");
  assert(!guestGotWord, "non-drawer did NOT receive word:assigned");

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
