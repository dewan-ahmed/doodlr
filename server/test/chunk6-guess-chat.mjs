// Verifies guess:submit: correct guesses get hidden/revealed appropriately,
// wrong guesses are broadcast as chat, drawer can't guess, and no double-dipping.
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

  // Wrong guess from guesser should broadcast as a "guess" chat message to everyone.
  const drawerSeesWrongGuess = new Promise((resolve) => drawer.once("chat:message", resolve));
  const guesserSeesOwnWrongGuess = new Promise((resolve) => guesser.once("chat:message", resolve));
  guesser.emit("guess:submit", { text: "definitely-wrong" });

  const [drawerMsg, guesserMsg] = await Promise.all([drawerSeesWrongGuess, guesserSeesOwnWrongGuess]);
  assert(drawerMsg.type === "guess" && drawerMsg.text === "definitely-wrong", "wrong guess broadcast to drawer as chat");
  assert(guesserMsg.type === "guess" && guesserMsg.playerId === guesser.id, "wrong guess echoed back to guesser too, with their id");

  // Drawer attempting to guess should be ignored entirely.
  let drawerGotOwnGuessEcho = false;
  drawer.once("chat:message", () => {
    drawerGotOwnGuessEcho = true;
  });
  drawer.emit("guess:submit", { text: word });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!drawerGotOwnGuessEcho, "drawer's own guess attempt is ignored (no chat message)");

  // Correct guess: guesser gets a private reveal, everyone else gets a vague "guessed it" message.
  const guesserCorrect = new Promise((resolve) => guesser.once("chat:message", resolve));
  const drawerSeesCorrectOther = new Promise((resolve) => drawer.once("chat:message", resolve));
  guesser.emit("guess:submit", { text: word.toUpperCase() }); // case-insensitive match

  const [guesserMsg2, drawerMsg2] = await Promise.all([guesserCorrect, drawerSeesCorrectOther]);
  assert(guesserMsg2.type === "correct-self" && guesserMsg2.text.includes(word), "correct guesser gets private reveal with the word");
  assert(drawerMsg2.type === "correct-other" && !drawerMsg2.text.includes(word), "everyone else sees a vague 'guessed it' message without the word");

  // Guessing again after already correct should be ignored (no spam).
  let guesserGotAnotherMessage = false;
  guesser.once("chat:message", () => {
    guesserGotAnotherMessage = true;
  });
  guesser.emit("guess:submit", { text: word });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!guesserGotAnotherMessage, "already-correct guesser can't guess again");

  drawer.close();
  guesser.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
