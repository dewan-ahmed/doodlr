// Verifies host-configurable pre-game settings (rounds per player, round
// duration): defaults are sent on join, only the host can change them,
// changes broadcast to everyone, values are clamped to safe bounds, and
// game:start actually honors the configured roundsPerPlayer/roundDurationMs.
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

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function onceAll(sockets, event) {
  return Promise.all(sockets.map((s) => once(s, event)));
}

async function main() {
  const alice = io(URL);
  const bob = io(URL);
  const sockets = [alice, bob];
  await Promise.all(sockets.map((s) => new Promise((resolve) => s.on("connect", resolve))));

  const createRes = await new Promise((resolve) => alice.emit("room:create", { name: "Alice" }, resolve));
  assert(
    createRes.settings &&
      Number.isFinite(createRes.settings.roundsPerPlayer) &&
      Number.isFinite(createRes.settings.roundDurationMs),
    "room:create response includes default settings"
  );

  const joinRes = await new Promise((resolve) => bob.emit("room:join", { code: createRes.room, name: "Bob" }, resolve));
  assert(
    JSON.stringify(joinRes.settings) === JSON.stringify(createRes.settings),
    "room:join response reflects the same settings the host sees"
  );

  // Non-host cannot change settings.
  const noUpdate = Promise.race([
    once(alice, "room:settings").then(() => "broadcast"),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 400)),
  ]);
  bob.emit("room:settings:update", { roundsPerPlayer: 1 });
  assert((await noUpdate) === "timeout", "non-host room:settings:update is ignored (no broadcast)");

  // Host updates settings -> broadcast to everyone, clamped to bounds.
  const settingsBroadcasts = onceAll(sockets, "room:settings");
  alice.emit("room:settings:update", { roundsPerPlayer: 1, roundDurationMs: 30_000 });
  const [settingsPayload] = await settingsBroadcasts;
  assert(settingsPayload.roundsPerPlayer === 1, "host can set roundsPerPlayer to 1");
  assert(settingsPayload.roundDurationMs === 30_000, "host can set roundDurationMs to 30s");

  const outOfBounds = onceAll(sockets, "room:settings");
  alice.emit("room:settings:update", { roundsPerPlayer: 999, roundDurationMs: 1 });
  const [clampedPayload] = await outOfBounds;
  assert(clampedPayload.roundsPerPlayer <= 5, "roundsPerPlayer is clamped to the max");
  assert(clampedPayload.roundDurationMs >= 30_000, "roundDurationMs is clamped to the min");

  // Set a known-small config, then start the game and verify it's honored:
  // 1 round/player x 2 players = 2 total turns, and the round duration in
  // round:start matches what the host configured.
  const finalSettings = onceAll(sockets, "room:settings");
  alice.emit("room:settings:update", { roundsPerPlayer: 1, roundDurationMs: 30_000 });
  await finalSettings;

  const choosing1 = onceAll(sockets, "round:choosing");
  const choices1Each = sockets.map((s) => once(s, "word:choices"));
  alice.emit("game:start");
  const [choosing1Payload] = await choosing1;

  const drawer1 = choosing1Payload.drawerId === alice.id ? alice : bob;
  const drawerIndex1 = drawer1 === alice ? 0 : 1;
  const { choices: choices1 } = await choices1Each[drawerIndex1];

  const roundStarts = onceAll(sockets, "round:start");
  drawer1.emit("word:choose", { word: choices1[0] });
  const [roundStartPayload] = await roundStarts;
  const expectedDuration = roundStartPayload.roundEndsAt - Date.now();
  assert(
    expectedDuration > 25_000 && expectedDuration <= 30_000,
    "round:start's roundEndsAt reflects the host-configured 30s round duration"
  );

  // With roundsPerPlayer=1 and 2 players, ending this single turn (the only
  // turn for this drawer, and the other player never got to draw) should NOT
  // yet end the game -- there's still one turn left for the other player.
  const choosing2 = onceAll(sockets, "round:choosing");
  const guesser1 = drawer1 === alice ? bob : alice;
  guesser1.emit("guess:submit", { text: choices1[0] });
  const [choosing2Payload] = await choosing2;
  assert(choosing2Payload.round === 2, "after turn 1, round 2 (the other player's only turn) starts");

  alice.close();
  bob.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
