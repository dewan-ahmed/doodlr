// Placeholder word bank. Swap this out / extend with your own categories later.
// Each word can optionally carry a `difficulty` (1 = easy, 2 = medium, 3 = hard).

export const wordBank = [
  { word: "pizza", difficulty: 1 },
  { word: "robot", difficulty: 1 },
  { word: "rainbow", difficulty: 1 },
  { word: "guitar", difficulty: 1 },
  { word: "volcano", difficulty: 2 },
  { word: "astronaut", difficulty: 2 },
  { word: "skateboard", difficulty: 2 },
  { word: "lighthouse", difficulty: 2 },
  { word: "time travel", difficulty: 3 },
  { word: "optical illusion", difficulty: 3 },
  { word: "parallel universe", difficulty: 3 },
];

export function getRandomWords(count = 3) {
  const shuffled = [...wordBank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
