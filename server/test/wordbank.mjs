// Unit test for the word bank — no server needed, just imports the module.
import { getRandomWords, wordBank } from "../src/wordBank.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

assert(wordBank.length >= 50, `word bank has a healthy size (${wordBank.length} words)`);

const words = wordBank.map((w) => w.word.toLowerCase());
const uniqueWords = new Set(words);
assert(uniqueWords.size === words.length, "no duplicate words in the bank");

const validDifficulties = wordBank.every((w) => [1, 2, 3].includes(w.difficulty));
assert(validDifficulties, "every word has a difficulty of 1, 2, or 3");

const allHaveCategory = wordBank.every((w) => typeof w.category === "string" && w.category.length > 0);
assert(allHaveCategory, "every word has a non-empty category");

for (let i = 0; i < 20; i++) {
  const three = getRandomWords(3);
  assert(three.length === 3, "getRandomWords(3) always returns exactly 3 words");
  const distinct = new Set(three.map((w) => w.word));
  assert(distinct.size === 3, "getRandomWords(3) never returns duplicate words within one call");
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
