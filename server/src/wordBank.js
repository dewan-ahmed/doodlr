// A broader, categorized word bank. Pulls a decent mix of easy/medium/hard
// words across everyday categories so rounds don't get repetitive.
// `difficulty`: 1 = easy, 2 = medium, 3 = hard (kept for potential future
// use, e.g. weighting word choices or showing a difficulty badge).

const ANIMALS = [
  { word: "cat", difficulty: 1, category: "animals" },
  { word: "dog", difficulty: 1, category: "animals" },
  { word: "elephant", difficulty: 1, category: "animals" },
  { word: "penguin", difficulty: 1, category: "animals" },
  { word: "octopus", difficulty: 2, category: "animals" },
  { word: "kangaroo", difficulty: 2, category: "animals" },
  { word: "flamingo", difficulty: 2, category: "animals" },
  { word: "platypus", difficulty: 3, category: "animals" },
  { word: "chameleon", difficulty: 3, category: "animals" },
  { word: "narwhal", difficulty: 3, category: "animals" },
];

const FOOD = [
  { word: "pizza", difficulty: 1, category: "food" },
  { word: "burger", difficulty: 1, category: "food" },
  { word: "taco", difficulty: 1, category: "food" },
  { word: "sushi", difficulty: 1, category: "food" },
  { word: "pancake", difficulty: 2, category: "food" },
  { word: "spaghetti", difficulty: 2, category: "food" },
  { word: "watermelon", difficulty: 2, category: "food" },
  { word: "croissant", difficulty: 3, category: "food" },
  { word: "popcorn", difficulty: 2, category: "food" },
  { word: "ice cream cone", difficulty: 3, category: "food" },
];

const OBJECTS = [
  { word: "guitar", difficulty: 1, category: "objects" },
  { word: "umbrella", difficulty: 1, category: "objects" },
  { word: "backpack", difficulty: 1, category: "objects" },
  { word: "lighthouse", difficulty: 2, category: "objects" },
  { word: "telescope", difficulty: 2, category: "objects" },
  { word: "skateboard", difficulty: 2, category: "objects" },
  { word: "chandelier", difficulty: 3, category: "objects" },
  { word: "typewriter", difficulty: 3, category: "objects" },
  { word: "hourglass", difficulty: 2, category: "objects" },
  { word: "trampoline", difficulty: 2, category: "objects" },
];

const NATURE = [
  { word: "rainbow", difficulty: 1, category: "nature" },
  { word: "volcano", difficulty: 2, category: "nature" },
  { word: "waterfall", difficulty: 2, category: "nature" },
  { word: "tornado", difficulty: 2, category: "nature" },
  { word: "avalanche", difficulty: 3, category: "nature" },
  { word: "coral reef", difficulty: 3, category: "nature" },
  { word: "shooting star", difficulty: 2, category: "nature" },
  { word: "thunderstorm", difficulty: 2, category: "nature" },
  { word: "desert", difficulty: 1, category: "nature" },
  { word: "glacier", difficulty: 2, category: "nature" },
];

const ACTIONS_AND_IDEAS = [
  { word: "robot", difficulty: 1, category: "ideas" },
  { word: "astronaut", difficulty: 2, category: "ideas" },
  { word: "time travel", difficulty: 3, category: "ideas" },
  { word: "optical illusion", difficulty: 3, category: "ideas" },
  { word: "parallel universe", difficulty: 3, category: "ideas" },
  { word: "superhero", difficulty: 1, category: "ideas" },
  { word: "haunted house", difficulty: 2, category: "ideas" },
  { word: "treasure map", difficulty: 2, category: "ideas" },
  { word: "sleepwalking", difficulty: 2, category: "ideas" },
  { word: "déjà vu", difficulty: 3, category: "ideas" },
  { word: "rock climbing", difficulty: 2, category: "ideas" },
  { word: "sandcastle", difficulty: 1, category: "ideas" },
  { word: "snowman", difficulty: 1, category: "ideas" },
  { word: "campfire", difficulty: 1, category: "ideas" },
  { word: "fireworks", difficulty: 1, category: "ideas" },
];

export const wordBank = [...ANIMALS, ...FOOD, ...OBJECTS, ...NATURE, ...ACTIONS_AND_IDEAS];

export function getRandomWords(count = 3) {
  const shuffled = [...wordBank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
