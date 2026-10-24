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

  // game:start kicks off the word-choice phase (round:choosing), not the
  // round directly — see chunk2-word-choice.mjs for the full word-pick flow.
  const hostChoosing = new Promise((resolve) => host.once("round:choosing", resolve));
  const guestChoosing = new Promise((resolve) => guest.once("round:choosing", resolve));

  host.emit("game:start");

  const [hostPayload, guestPayload] = await Promise.all([hostChoosing, guestChoosing]);
  // Drawer order is shuffled each game, so either player may go first --
  // just assert a valid player was picked and everyone agrees who it is.
  assert(
    [host.id, guest.id].includes(hostPayload.drawerId),
    "the selected drawer is one of the two players in the room"
  );
  assert(guestPayload.drawerId === hostPayload.drawerId, "both clients agree on drawer");

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
