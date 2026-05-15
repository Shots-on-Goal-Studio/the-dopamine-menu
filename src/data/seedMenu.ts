export type Category = "quick" | "medium" | "big";

export type SeedItem = {
  name: string;
  detail: string;
  category: Category;
};

export const TIME_LABELS: Record<Category, string> = {
  quick: "2 minutes",
  medium: "15 minutes",
  big: "1 hour",
};

export const COST_LABELS: Record<Category, string> = {
  quick: "2 min",
  medium: "15 min",
  big: "1 hr",
};

export const SECTION_TITLES: Record<Category, string> = {
  quick: "Quick Hits",
  medium: "Medium Wins",
  big: "Big Indulgences",
};

export const SECTION_TIMES: Record<Category, string> = {
  quick: "~ 2 min",
  medium: "~ 15 min",
  big: "~ 1 hour",
};

export const SECTION_PLACEHOLDERS: Record<Category, string> = {
  quick: "e.g. Stretch at the window",
  medium: "e.g. Practice scales",
  big: "e.g. Build a small Lovable demo",
};

export const SEED_MENU: SeedItem[] = [
  // Quick (~2 min)
  { name: "Step outside, look at the sky", detail: "Sun + sky reset", category: "quick" },
  { name: "Cold water on the face", detail: "Vagal nerve trick", category: "quick" },
  { name: "Loud song, full volume", detail: "One track. No skipping.", category: "quick" },
  { name: "20 jumping jacks", detail: "Wake the system up", category: "quick" },
  { name: "Write one sentence by hand", detail: "On real paper", category: "quick" },
  { name: "Text someone you love", detail: "No agenda", category: "quick" },

  // Medium (~15 min)
  { name: "Walk around the block", detail: "No phone. Just walk.", category: "medium" },
  { name: "Make a proper coffee", detail: "The whole ritual", category: "medium" },
  { name: "Stretch session", detail: "Just five poses", category: "medium" },
  { name: "Sketch the room you're in", detail: "Five minutes. Don't judge.", category: "medium" },
  { name: "Tidy one small surface", detail: "Visible result", category: "medium" },
  { name: "Read one article, fully", detail: "No tabs open", category: "medium" },

  // Big (~1 hour)
  { name: "Cook something new", detail: "The recipe you saved", category: "big" },
  { name: "Go to the gym", detail: "Don't plan. Just go.", category: "big" },
  { name: "Long walk + podcast", detail: "Loop the park", category: "big" },
  { name: "Coffee with a friend", detail: "In person, no agenda", category: "big" },
  { name: "Side project — fun part only", detail: "Skip the boring bits", category: "big" },
  { name: "Hands-on hobby session", detail: "No screens involved", category: "big" },
];

export const seedByCategory = (cat: Category) =>
  SEED_MENU.filter((i) => i.category === cat);
