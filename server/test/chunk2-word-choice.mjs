// Verifies the word-choice flow: drawer gets 3 private choices, picks one,
// and only then does everyone receive round:start with the real word length.
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
  await new Promise((resolve) =>
    guest.emit("room:join", { code: createRes.room, name: "Bob" }, resolve)
  );

  const hostChoosing = new Promise((resolve) => host.once("round:choosing", resolve));
  const guestChoosing = new Promise((resolve) => guest.once("round:choosing", resolve));
  const hostChoicesPromise = new Promise((resolve) => host.once("word:choices", resolve));
  const guestChoicesPromise = new Promise((resolve) => guest.once("word:choices", resolve));

  host.emit("game:start");

  const [hostChoosingPayload, guestChoosingPayload] = await Promise.all([hostChoosing, guestChoosing]);
  assert(
    guestChoosingPayload.drawerId === hostChoosingPayload.drawerId,
    "round:choosing tells everyone who's drawing"
  );

  // Drawer order is shuffled each game, so figure out which socket is
  // actually drawing instead of assuming it's always the host.
  const drawerId = hostChoosingPayload.drawerId;
  const drawer = drawerId === host.id ? host : guest;
  const nonDrawer = drawer === host ? guest : host;
  const drawerChoicesPromise = drawer === host ? hostChoicesPromise : guestChoicesPromise;

  // round:start should NOT fire yet, before the drawer picks.
  let roundStartedEarly = false;
  nonDrawer.once("round:start", () => {
    roundStartedEarly = true;
  });

  let nonDrawerGotChoices = false;
  nonDrawer.once("word:choices", () => {
    nonDrawerGotChoices = true;
  });

  const { choices } = await drawerChoicesPromise;
  assert(Array.isArray(choices) && choices.length === 3, "drawer receives exactly 3 word choices");
  assert(!nonDrawerGotChoices, "non-drawer did NOT receive word choices");

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert(!roundStartedEarly, "round:start has not fired before the drawer chooses");

  const hostRoundStart = new Promise((resolve) => host.once("round:start", resolve));
  const guestRoundStart = new Promise((resolve) => guest.once("round:start", resolve));

  const chosenWord = choices[0];
  drawer.emit("word:choose", { word: chosenWord });

  const [hostPayload, guestPayload] = await Promise.all([hostRoundStart, guestRoundStart]);
  assert(hostPayload.wordLength === chosenWord.length, "round:start wordLength matches chosen word");
  assert(guestPayload.drawerId === drawerId, "guest sees the correct drawer in round:start");

  // An invalid choice should be ignored; try choosing again with a bogus word.
  let secondRoundStartFired = false;
  drawer.once("round:start", () => {
    secondRoundStartFired = true;
  });
  drawer.emit("word:choose", { word: "not-a-real-choice" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert(!secondRoundStartFired, "invalid/late word:choose is ignored (room already playing)");

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
