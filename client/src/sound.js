// Lightweight sound effects synthesized with the Web Audio API -- no audio
// files to fetch or bundle, works offline, and is trivial to mute.
const MUTE_KEY = "doodlr:muted";

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function playTone({ freq, duration = 0.15, delay = 0, type = "sine", gain = 0.08 }) {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // Browsers suspend a freshly-created AudioContext until a user gesture --
  // resume defensively since by the time a sound plays the user has already
  // interacted with the page (joined a room, typed a guess, etc).
  if (ctx.state === "suspended") ctx.resume();

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const startTime = ctx.currentTime + delay;
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// Upbeat rising chime -- played for the player who just guessed correctly.
export function playOwnCorrectGuess() {
  playTone({ freq: 523.25, duration: 0.12 }); // C5
  playTone({ freq: 659.25, duration: 0.16, delay: 0.09 }); // E5
  playTone({ freq: 783.99, duration: 0.22, delay: 0.18 }); // G5
}

// Quieter single blip -- played for everyone else when someone else gets it.
export function playOtherCorrectGuess() {
  playTone({ freq: 659.25, duration: 0.1, gain: 0.04 });
}

// Neutral descending cue -- played when a round ends (timeout, drawer left,
// or everyone guessed it).
export function playRoundEnd() {
  playTone({ freq: 392.0, duration: 0.15, type: "triangle", gain: 0.06 });
  playTone({ freq: 329.63, duration: 0.22, delay: 0.12, type: "triangle", gain: 0.06 });
}
