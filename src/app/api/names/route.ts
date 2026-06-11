import { NextResponse } from "next/server";

const DISPLAY_COUNT = 20;
// Half the set is one-syllable, half is two-syllable, so every run has the
// same memorization difficulty regardless of which words are drawn.
const PER_SYLLABLE = DISPLAY_COUNT / 2;

const ONE_SYLLABLE_WORDS = [
  "chair",
  "book",
  "lamp",
  "cloud",
  "stone",
  "bread",
  "glass",
  "train",
  "leaf",
  "hand",
  "road",
  "fish",
  "moon",
  "gate",
  "shoe",
  "clock",
  "brick",
  "flame",
  "knife",
  "branch",
  "pearl",
  "shield",
  "plant",
  "frost",
  "drum",
  "wheel",
  "broom",
  "crown",
  "snake",
  "storm",
];

const TWO_SYLLABLE_WORDS = [
  "pillow",
  "garden",
  "candle",
  "river",
  "mirror",
  "basket",
  "tiger",
  "planet",
  "anchor",
  "copper",
  "hammer",
  "jacket",
  "ladder",
  "monkey",
  "pumpkin",
  "rocket",
  "saddle",
  "temple",
  "velvet",
  "window",
  "button",
  "castle",
  "dragon",
  "engine",
  "forest",
  "harbor",
  "island",
  "lantern",
  "magnet",
  "needle",
];

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export async function GET() {
  try {
    const ones = shuffle(ONE_SYLLABLE_WORDS).slice(0, PER_SYLLABLE);
    const twos = shuffle(TWO_SYLLABLE_WORDS).slice(0, PER_SYLLABLE);
    const words = shuffle([...ones, ...twos]);

    if (words.length < DISPLAY_COUNT) {
      return NextResponse.json(
        { error: "Not enough words available to build the set." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      names: words,
      poolSize: ONE_SYLLABLE_WORDS.length + TWO_SYLLABLE_WORDS.length,
    });
  } catch (error) {
    console.error("/api/names failure", error);
    return NextResponse.json(
      { error: "Unable to load words." },
      { status: 500 }
    );
  }
}
