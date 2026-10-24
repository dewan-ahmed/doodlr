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

  // Drawer order is shuffled each game, so figure out who's actually
  // drawing instead of assuming it's always the host.
  const hostChoosing = new Promise((resolve) => host.once("round:choosing", resolve));
  const hostChoicesPromise = new Promise((resolve) => host.once("word:choices", resolve));
  const guestChoicesPromise = new Promise((resolve) => guest.once("word:choices", resolve));
  host.emit("game:start");

  const { drawerId } = await hostChoosing;
  const drawer = drawerId === host.id ? host : guest;
  const nonDrawer = drawer === host ? guest : host;
  const { choices } = await (drawer === host ? hostChoicesPromise : guestChoicesPromise);

  const roundStart = new Promise((resolve) => drawer.once("round:start", resolve));
  drawer.emit("word:choose", { word: choices[0] });
  await roundStart;

  return { drawer, nonDrawer };
}

async function main() {
  const { drawer, nonDrawer } = await setupPlayingRoom();

  const segment = { from: { x: 0.1, y: 0.1 }, to: { x: 0.2, y: 0.2 }, color: "#000", size: 4 };

  // Drawer's stroke should reach the non-drawer, and NOT echo back to the drawer itself.
  const nonDrawerReceived = new Promise((resolve) => nonDrawer.once("drawing:stroke", resolve));
  let drawerEchoed = false;
  drawer.once("drawing:stroke", () => {
    drawerEchoed = true;
  });

  drawer.emit("drawing:stroke", segment);

  const received = await nonDrawerReceived;
  assert(JSON.stringify(received) === JSON.stringify(segment), "non-drawer receives the exact stroke segment the drawer sent");

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert(!drawerEchoed, "drawer does not receive its own stroke back");

  // Non-drawer sending a stroke should be ignored — drawer should not receive it.
  let drawerGotBogusStroke = false;
  drawer.once("drawing:stroke", () => {
    drawerGotBogusStroke = true;
  });
  nonDrawer.emit("drawing:stroke", segment);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!drawerGotBogusStroke, "non-drawer's stroke is ignored by the server");

  drawer.close();
  nonDrawer.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
