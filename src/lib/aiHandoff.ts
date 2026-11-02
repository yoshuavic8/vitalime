import type { AiFoodComponent, AiFoodResult, MealType } from "../db/types";
import { MEAL_LABEL } from "./labels";

/**
 * Manual hand-off: the app never calls an AI API. The user shares photo + prompt to Grok
 * (iPhone Share sheet) or Cursor (desktop chat), then pastes the JSON answer back.
 * Nothing is saved as final until the user confirms.
 */
export function buildFoodPrompt(opts: { mealType: MealType; description?: string; portionHint?: string }) {
  return [
    "Kamu asisten estimasi gizi untuk makanan Indonesia (rumah, warung, restoran).",
    "Analisis FOTO makanan yang dilampirkan. Jangan mengarang makanan yang tidak terlihat.",
    `Waktu makan: ${MEAL_LABEL[opts.mealType]}.`,
    opts.description ? `Keterangan dari saya: ${opts.description}.` : "",
    opts.portionHint ? `Petunjuk porsi: ${opts.portionHint}.` : "",
    "",
    "Aturan:",
    "- Identifikasi setiap komponen di piring (nasi, lauk, sayur, sambal, kerupuk, minuman).",
    "- Sertakan minyak/santan/gorengan yang terlihat atau yang biasa dipakai pada hidangan itu.",
    "- Taksir gram per komponen (centong nasi ≈ 100 g, sebutir telur ≈ 55 g, 1 sdm minyak ≈ 14 g).",
    "- Jangan mengaku gram itu pasti; jelaskan asumsi porsi di portion_assumption.",
    "- Beri rentang kalori bila porsi tidak jelas atau foto buram.",
    "- Jika tidak bisa memperkirakan, isi clarifying_questions dan tetap beri estimasi terbaik.",
    "- Kalori total = jumlah komponen (termasuk minyak).",
    "",
    "Balas HANYA dengan JSON valid persis seperti ini (tanpa markdown, tanpa teks lain):",
    JSON.stringify(
      {
        food_name: "string",
        components: [
          {
            name: "string",
            estimated_portion: "string",
            grams: 0,
            calories_kcal: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
          },
        ],
        portion_assumption: "string",
        calories_kcal: 0,
        calories_range: [0, 0],
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        confidence: "low | medium | high",
        clarifying_questions: ["string"],
      },
      null,
      2,
    ),
  ]
    .filter((l) => l !== "")
    .join("\n");
}

const optNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function parseComponent(raw: unknown): AiFoodComponent | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (!name || name === "string") return undefined;
  return {
    name,
    estimated_portion: o.estimated_portion ? String(o.estimated_portion) : undefined,
    grams: optNum(o.grams),
    calories_kcal: optNum(o.calories_kcal),
    protein_g: optNum(o.protein_g),
    carbs_g: optNum(o.carbs_g),
    fat_g: optNum(o.fat_g),
  };
}

/** Accepts raw JSON or JSON wrapped in prose / ```json fences, as assistants often reply. */
export function parseAiFoodResult(text: string): AiFoodResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate.trim()) throw new Error("Tidak menemukan JSON pada jawaban AI.");
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(candidate);
  } catch {
    throw new Error("JSON dari AI tidak valid. Minta AI membalas hanya dengan JSON.");
  }
  const num = (k: string) => {
    const v = Number(obj[k]);
    if (!Number.isFinite(v) || v < 0) throw new Error(`Field "${k}" tidak valid.`);
    return v;
  };
  const components = Array.isArray(obj.components)
    ? obj.components.map(parseComponent).filter((c): c is AiFoodComponent => !!c)
    : undefined;
  const range = Array.isArray(obj.calories_range) && obj.calories_range.length === 2
    ? (obj.calories_range.map(Number) as [number, number])
    : undefined;
  const confidence = ["low", "medium", "high"].includes(String(obj.confidence))
    ? (obj.confidence as AiFoodResult["confidence"])
    : undefined;
  return {
    food_name: String(obj.food_name ?? "Makanan"),
    components: components?.length ? components : undefined,
    portion_assumption: obj.portion_assumption ? String(obj.portion_assumption) : undefined,
    calories_kcal: num("calories_kcal"),
    calories_range: range && range.every(Number.isFinite) ? range : undefined,
    protein_g: num("protein_g"),
    carbs_g: num("carbs_g"),
    fat_g: num("fat_g"),
    confidence,
    clarifying_questions: Array.isArray(obj.clarifying_questions)
      ? (obj.clarifying_questions as unknown[]).map(String).filter((q) => q && q !== "string")
      : undefined,
  };
}
