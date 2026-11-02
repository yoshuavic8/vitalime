import type { AiFoodComponent, FoodItemLine } from "../db/types";
import { FOODS, type FoodItem } from "../data/foods";

export type Per100 = { kcal: number; protein: number; carbs: number; fat: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scaleNutrients(per100: Per100, grams: number) {
  const k = grams / 100;
  return {
    caloriesKcal: Math.round(per100.kcal * k),
    proteinG: round1(per100.protein * k),
    carbsG: round1(per100.carbs * k),
    fatG: round1(per100.fat * k),
  };
}

export function sumLines(lines: Pick<FoodItemLine, "caloriesKcal" | "proteinG" | "carbsG" | "fatG" | "grams">[]) {
  return lines.reduce(
    (t, l) => ({
      caloriesKcal: t.caloriesKcal + l.caloriesKcal,
      proteinG: round1(t.proteinG + l.proteinG),
      carbsG: round1(t.carbsG + l.carbsG),
      fatG: round1(t.fatG + l.fatG),
      grams: t.grams + l.grams,
    }),
    { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, grams: 0 },
  );
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Every query word must prefix-match a word of the name or an alias. Ranked: name starts with
 * the query, then name match, then alias-only match.
 */
export function searchFoods(query: string, foods: FoodItem[] = FOODS, limit = 40): FoodItem[] {
  const q = normalize(query);
  if (!q) return [];
  const terms = q.split(" ");
  const scored: { f: FoodItem; score: number }[] = [];
  for (const f of foods) {
    const name = normalize(f.name);
    const aliases = f.aliases.map(normalize);
    const words = [name, ...aliases].join(" ").split(" ");
    if (!terms.every((t) => words.some((w) => w.startsWith(t)))) continue;
    const nameWords = name.split(" ");
    const inName = terms.every((t) => nameWords.some((w) => w.startsWith(t)));
    const score = (name.startsWith(q) ? 0 : 2) + (inName ? 0 : 1) + (aliases.some((a) => a === q) ? -1 : 0);
    scored.push({ f, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.f.name.length - b.f.name.length).slice(0, limit).map((x) => x.f);
}

export function lineFromFood(f: FoodItem, grams: number, serving?: string): FoodItemLine {
  return { name: f.name, grams: Math.round(grams), serving, ...scaleNutrients(f, grams), source: "local_db", refId: f.id };
}

/** "1 centong (~100 g)", "150g", "2 sdm" → grams when a metric unit is present. */
export function parseGramsHint(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(k?g|gram|ml)\b/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return /kg/i.test(m[2]) ? n * 1000 : n;
}

/**
 * Turn AI plate components into editable lines. Known Indonesian foods are matched to the
 * offline database (so the user can tweak grams); unknown items keep the AI macros.
 */
export function linesFromAiComponents(components: AiFoodComponent[]): FoodItemLine[] {
  return components.map((c) => {
    const hinted = c.grams ?? parseGramsHint(c.estimated_portion);
    const hits = searchFoods(c.name);
    const food = hits[0];
    if (food) {
      const grams = hinted ?? food.servings[0]?.grams ?? 100;
      return lineFromFood(food, grams, c.estimated_portion);
    }
    const grams = hinted ?? 100;
    return {
      name: c.name,
      grams: Math.round(grams),
      serving: c.estimated_portion,
      caloriesKcal: Math.round(c.calories_kcal ?? 0),
      proteinG: round1(c.protein_g ?? 0),
      carbsG: round1(c.carbs_g ?? 0),
      fatG: round1(c.fat_g ?? 0),
      source: "ai_estimate" as const,
    };
  });
}
