// Verifies drawing:clear relay: only the drawer can clear, and the clear
// event reaches everyone else but never echoes back to the sender.
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

  return { host, guest };
}

async function main() {
  const { host, guest } = await setupPlayingRoom();

  const guestCleared = new Promise((resolve) => guest.once("drawing:clear", resolve));
  let hostEchoed = false;
  host.once("drawing:clear", () => {
    hostEchoed = true;
  });

  host.emit("drawing:clear");
  await guestCleared;
  assert(true, "guest receives drawing:clear from the drawer");

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert(!hostEchoed, "drawer does not receive its own clear event back");

  let hostGotBogusClear = false;
  host.once("drawing:clear", () => {
    hostGotBogusClear = true;
  });
  guest.emit("drawing:clear");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!hostGotBogusClear, "non-drawer's clear request is ignored by the server");

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
