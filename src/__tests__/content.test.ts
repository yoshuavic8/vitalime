import { describe, expect, it } from "vitest";
import { EXERCISE_SEED } from "../data/exercises";
import { FOODS } from "../data/foods";
import { MOTIONS } from "../data/motions";
import { PROGRAM_TEMPLATES } from "../data/programTemplates";
import { SPRITE_ROWS } from "../data/spriteIndex";
import { progressionHint, swapCandidates } from "../db/repo/training";
import { EQUIPMENT, HOME_EQUIPMENT, type Exercise, type WorkoutSession, type WorkoutSet } from "../db/types";
import { lineFromFood, linesFromAiComponents, parseGramsHint, scaleNutrients, searchFoods, sumLines } from "../lib/foodCalc";
import { parseOffProduct } from "../lib/openFoodFacts";
import { poseAt } from "../lib/pose";
import { formatSet, targetLabel } from "../lib/sets";

const exercises = EXERCISE_SEED.map((e) => ({ ...e, isCustom: false, createdAt: "" })) as Exercise[];
const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));

describe("exercise content", () => {
  it("every built-in exercise has a motion and a sprite row, and vice versa", () => {
    const ids = EXERCISE_SEED.map((e) => e.id).sort();
    expect(Object.keys(MOTIONS).sort()).toEqual(ids);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual(ids);
  });

  it("alternatives point at existing exercises", () => {
    for (const e of EXERCISE_SEED) for (const a of e.alternatives) expect(byId[a], `${e.id} → ${a}`).toBeDefined();
  });

  it("every motion produces finite poses through the whole loop", () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      for (const t of [0, 0.13, 0.5, 0.77, 0.99]) {
        const p = poseAt(m, t);
        const nums = [...p.hip, p.torso, ...p.armN, ...p.armF, ...p.legN, ...p.legF];
        expect(nums.every(Number.isFinite), `${id} @${t}`).toBe(true);
      }
    }
  });

  it("templates only use known exercises, with sane targets", () => {
    for (const t of PROGRAM_TEMPLATES) {
      expect(t.days.length, t.key).toBeGreaterThan(0);
      for (const d of t.days) {
        for (const x of d.exercises) {
          expect(byId[x.exerciseId], `${t.key}/${x.exerciseId}`).toBeDefined();
          expect(x.repMin).toBeLessThanOrEqual(x.repMax);
          expect(x.sets).toBeGreaterThan(0);
        }
      }
    }
    expect(new Set(PROGRAM_TEMPLATES.map((t) => t.key)).size).toBe(PROGRAM_TEMPLATES.length);
  });

  it("home templates can be done with home equipment", () => {
    for (const t of PROGRAM_TEMPLATES.filter((x) => x.place === "home")) {
      for (const d of t.days) for (const x of d.exercises) expect(HOME_EQUIPMENT, `${t.key}/${x.exerciseId}`).toContain(byId[x.exerciseId].equipment);
    }
  });
});

describe("swapCandidates", () => {
  it("puts listed alternatives first and respects available equipment", () => {
    const bench = byId["ex-bench"];
    const all = swapCandidates(bench, exercises, EQUIPMENT);
    expect(all[0].id).toBe(bench.alternatives[0]);
    const home = swapCandidates(bench, exercises, HOME_EQUIPMENT);
    expect(home.every((e) => HOME_EQUIPMENT.includes(e.equipment))).toBe(true);
    expect(home.map((e) => e.id)).toContain("ex-pushup");
    expect(home.map((e) => e.id)).not.toContain("ex-bench");
  });
});

describe("metric-aware sets", () => {
  const session = { id: "s", hadPain: false, isDeload: false } as WorkoutSession;
  const set = (p: Partial<WorkoutSet>) => ({ completed: true, ...p }) as WorkoutSet;

  it("timed holds progress on duration, not reps", () => {
    const last = { session, sets: [set({ durationSec: 45 }), set({ durationSec: 45 })] };
    expect(progressionHint(last, { repMax: 45, targetSets: 2 }, "time")?.kind).toBe("increase");
    expect(progressionHint({ session, sets: [set({ durationSec: 30 })] }, { repMax: 45 }, "time")?.kind).toBe("hold");
  });

  it("formats targets and sets per metric", () => {
    expect(targetLabel(30, 45, "time")).toBe("30–45 dtk");
    expect(targetLabel(20, 20, "cardio")).toBe("20 mnt");
    expect(formatSet(set({ durationSec: 1800, distanceKm: 5.2 }), "cardio")).toBe("30 mnt · 5,2 km");
    expect(formatSet(set({ weightKg: 60, reps: 8, rpe: 8 }), "reps")).toBe("60×8 @8");
  });
});

describe("food database", () => {
  it("has unique ids and plausible energy (Atwater check within 25%)", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      const atwater = f.protein * 4 + f.carbs * 4 + f.fat * 9;
      if (f.kcal < 20) continue;
      expect(Math.abs(atwater - f.kcal) / f.kcal, f.id).toBeLessThan(0.25);
      expect(f.servings.length, f.id).toBeGreaterThan(0);
    }
  });

  it("finds Indonesian names, aliases and partial words", () => {
    expect(searchFoods("nasi")[0].id).toBe("nasi-putih");
    expect(searchFoods("tempe gor").map((f) => f.id)).toContain("tempe-goreng");
    expect(searchFoods("indomie").map((f) => f.id)).toEqual(expect.arrayContaining(["indomie-goreng", "indomie-kuah"]));
    expect(searchFoods("chicken breast")[0].id).toBe("dada-ayam-rebus");
    expect(searchFoods("   ")).toEqual([]);
  });

  it("turns AI components into database lines when the name is known", () => {
    expect(parseGramsHint("1 centong (~100 g)")).toBe(100);
    expect(parseGramsHint("1.5 kg")).toBe(1500);
    const lines = linesFromAiComponents([
      { name: "Nasi putih", estimated_portion: "1,5 centong (~150 g)", grams: 150 },
      { name: "Hidangan alien", estimated_portion: "1 porsi", calories_kcal: 400, protein_g: 10, carbs_g: 40, fat_g: 20 },
    ]);
    expect(lines[0]).toMatchObject({ name: "Nasi putih", grams: 150, source: "local_db", refId: "nasi-putih" });
    expect(lines[1]).toMatchObject({ name: "Hidangan alien", source: "ai_estimate", caloriesKcal: 400 });
  });

  it("scales per-100 g values and sums a plate", () => {
    expect(scaleNutrients({ kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 }, 200)).toEqual({ caloriesKcal: 260, proteinG: 5.4, carbsG: 56.4, fatG: 0.6 });
    const nasi = FOODS.find((f) => f.id === "nasi-putih")!;
    const telur = FOODS.find((f) => f.id === "telur-rebus")!;
    const plate = [lineFromFood(nasi, 150, "1,5 × 1 centong"), lineFromFood(telur, 55)];
    expect(sumLines(plate)).toMatchObject({ caloriesKcal: 195 + 85, grams: 205 });
  });
});

describe("parseOffProduct", () => {
  it("reads kcal, falls back to kJ, and rejects products without energy", () => {
    const p = parseOffProduct({
      code: "089686010947",
      product_name: "Mi Goreng",
      brands: "Indomie, Indofood",
      serving_quantity: "85",
      serving_size: "85 g",
      nutriments: { "energy-kcal_100g": 447, proteins_100g: 9.4, carbohydrates_100g: 63.5, fat_100g: 16.5 },
    });
    expect(p).toMatchObject({ name: "Mi Goreng", brand: "Indomie", servingGrams: 85, per100: { kcal: 447, protein: 9.4 } });
    expect(parseOffProduct({ code: "1", product_name: "X", nutriments: { energy_100g: 418.4 } })?.per100.kcal).toBe(100);
    expect(parseOffProduct({ code: "1", product_name: "X", nutriments: {} })).toBeUndefined();
  });
});
