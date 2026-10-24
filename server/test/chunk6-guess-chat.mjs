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

  // Wrong guess from guest should broadcast as a "guess" chat message to everyone.
  const hostSeesWrongGuess = new Promise((resolve) => host.once("chat:message", resolve));
  const guestSeesOwnWrongGuess = new Promise((resolve) => guest.once("chat:message", resolve));
  guest.emit("guess:submit", { text: "definitely-wrong" });

  const [hostMsg, guestMsg] = await Promise.all([hostSeesWrongGuess, guestSeesOwnWrongGuess]);
  assert(hostMsg.type === "guess" && hostMsg.text === "definitely-wrong", "wrong guess broadcast to drawer as chat");
  assert(guestMsg.type === "guess" && guestMsg.name === "Bob", "wrong guess echoed back to guesser too, with their name");

  // Drawer attempting to guess should be ignored entirely.
  let hostGotOwnGuessEcho = false;
  host.once("chat:message", () => {
    hostGotOwnGuessEcho = true;
  });
  host.emit("guess:submit", { text: word });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!hostGotOwnGuessEcho, "drawer's own guess attempt is ignored (no chat message)");

  // Correct guess: guesser gets a private reveal, everyone else gets a vague "guessed it" message.
  const guestCorrect = new Promise((resolve) => guest.once("chat:message", resolve));
  const hostSeesCorrectOther = new Promise((resolve) => host.once("chat:message", resolve));
  guest.emit("guess:submit", { text: word.toUpperCase() }); // case-insensitive match

  const [guestMsg2, hostMsg2] = await Promise.all([guestCorrect, hostSeesCorrectOther]);
  assert(guestMsg2.type === "correct-self" && guestMsg2.text.includes(word), "correct guesser gets private reveal with the word");
  assert(hostMsg2.type === "correct-other" && !hostMsg2.text.includes(word), "everyone else sees a vague 'guessed it' message without the word");

  // Guessing again after already correct should be ignored (no spam).
  let guestGotAnotherMessage = false;
  guest.once("chat:message", () => {
    guestGotAnotherMessage = true;
  });
  guest.emit("guess:submit", { text: word });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(!guestGotAnotherMessage, "already-correct guesser can't guess again");

  host.close();
  guest.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
