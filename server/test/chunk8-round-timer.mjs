// Verifies round:end fires on (a) everyone guessing correctly and
// (b) the round timer expiring. Run against a server started with a short
// ROUND_DURATION_MS so the timeout path doesn't take 80s.
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

async function setupPlayingRoom(names) {
  const sockets = names.map(() => io(URL));
  await Promise.all(sockets.map((s) => new Promise((resolve) => s.on("connect", resolve))));

  const [host, ...rest] = sockets;
  const createRes = await new Promise((resolve) =>
    host.emit("room:create", { name: names[0] }, resolve)
  );
  for (let i = 0; i < rest.length; i++) {
    await new Promise((resolve) =>
      rest[i].emit("room:join", { code: createRes.room, name: names[i + 1] }, resolve)
    );
  }

  const hostChoices = new Promise((resolve) => host.once("word:choices", resolve));
  host.emit("game:start");
  const { choices } = await hostChoices;

  const roundStarts = sockets.map((s) => new Promise((resolve) => s.once("round:start", resolve)));
  host.emit("word:choose", { word: choices[0] });
  const [roundStartPayload] = await Promise.all(roundStarts);

  return { sockets, host, guests: rest, word: choices[0], roundStartPayload };
}

async function testAllCorrectEndsRoundEarly() {
  const { sockets, host, guests, word } = await setupPlayingRoom(["Alice", "Bob", "Carol"]);

  const roundEnds = sockets.map((s) => new Promise((resolve) => s.once("round:end", resolve)));

  for (const guest of guests) {
    guest.emit("guess:submit", { text: word });
  }

  const results = await Promise.all(roundEnds);
  assert(
    results.every((r) => r.reason === "all-correct"),
    "round:end fires with reason 'all-correct' once every guesser has guessed, for every client"
  );
  assert(results.every((r) => r.word === word), "round:end payload reveals the correct word to everyone");

  sockets.forEach((s) => s.close());
}

async function testTimeoutEndsRound() {
  const { sockets, word, roundStartPayload } = await setupPlayingRoom(["Dan", "Eve"]);

  const roundEnds = sockets.map((s) => new Promise((resolve) => s.once("round:end", resolve)));

  const msUntilEnd = roundStartPayload.roundEndsAt - Date.now();
  assert(msUntilEnd > 0 && msUntilEnd < 5000, "roundEndsAt reflects the short ROUND_DURATION_MS used for this test");

  const results = await Promise.all(roundEnds);
  assert(results.every((r) => r.reason === "timeout"), "round:end fires with reason 'timeout' when nobody guesses in time");
  assert(results.every((r) => r.word === word), "timeout round:end still reveals the word");

  sockets.forEach((s) => s.close());
}

async function main() {
  await testAllCorrectEndsRoundEarly();
  await testTimeoutEndsRound();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
