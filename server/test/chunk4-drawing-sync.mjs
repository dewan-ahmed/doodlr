// Verifies drawing:stroke relay: only the current drawer's strokes get
// broadcast to everyone else, and the sender never gets its own stroke echoed.
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

  return { host, guest }; // host is the drawer (first player)
}

async function main() {
  const { host, guest } = await setupPlayingRoom();

  const segment = { from: { x: 0.1, y: 0.1 }, to: { x: 0.2, y: 0.2 }, color: "#000", size: 4 };

  // Drawer's stroke should reach guest, and NOT echo back to the drawer itself.
  const guestReceived = new Promise((resolve) => guest.once("drawing:stroke", resolve));
  let hostEchoed = false;
  host.once("drawing:stroke", () => {
    hostEchoed = true;
  });

  host.emit("drawing:stroke", segment);

  const received = await guestReceived;
  assert(JSON.stringify(received) === JSON.stringify(segment), "guest receives the exact stroke segment the drawer sent");

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert(!hostEchoed, "drawer does not receive its own stroke back");

  // Non-drawer (guest) sending a stroke should be ignored — host should not receive it.
  let hostGotBogusStroke = false;
  host.once("drawing:stroke", () => {
    hostGotBogusStroke = true;
  });
  guest.emit("drawing:stroke", segment);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!hostGotBogusStroke, "non-drawer's stroke is ignored by the server");

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
