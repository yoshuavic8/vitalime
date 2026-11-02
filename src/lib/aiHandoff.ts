import type { AiFoodResult, MealType } from "../db/types";
import { MEAL_LABEL } from "./labels";

/**
 * Manual hand-off: the app never calls an AI API. The user shares photo + prompt to the Grok app
 * (or any assistant), then pastes the JSON answer back. Nothing is saved as final until confirmed.
 */
export function buildFoodPrompt(opts: { mealType: MealType; description?: string; portionHint?: string }) {
  return [
    "Kamu adalah asisten estimasi gizi. Analisis foto makanan terlampir.",
    `Waktu makan: ${MEAL_LABEL[opts.mealType]}.`,
    opts.description ? `Keterangan dari saya: ${opts.description}.` : "",
    opts.portionHint ? `Petunjuk porsi: ${opts.portionHint}.` : "",
    "",
    "Aturan:",
    "- Identifikasi makanan dan komponennya (termasuk minyak/saus yang terlihat).",
    "- Jangan mengarang berat gram seolah pasti; jelaskan asumsi porsi.",
    "- Berikan rentang kalori bila porsi tidak jelas.",
    "- Jika tidak bisa memperkirakan, isi clarifying_questions.",
    "",
    "Balas HANYA dengan JSON valid persis dengan bentuk ini (tanpa teks lain):",
    JSON.stringify(
      {
        food_name: "string",
        components: [{ name: "string", estimated_portion: "string" }],
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
  const range = Array.isArray(obj.calories_range) && obj.calories_range.length === 2
    ? (obj.calories_range.map(Number) as [number, number])
    : undefined;
  const confidence = ["low", "medium", "high"].includes(String(obj.confidence))
    ? (obj.confidence as AiFoodResult["confidence"])
    : undefined;
  return {
    food_name: String(obj.food_name ?? "Makanan"),
    components: Array.isArray(obj.components) ? (obj.components as AiFoodResult["components"]) : undefined,
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
