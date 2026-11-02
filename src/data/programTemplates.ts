import type { Split } from "../db/types";

/** repMin/repMax are reps for rep-based exercises, seconds for timed holds, minutes for cardio. */
export type TemplateExercise = {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
};

export type ProgramGoal = "beginner" | "hypertrophy" | "strength" | "fat_loss" | "calisthenics" | "glutes" | "cardio" | "mobility";
export type ProgramPlace = "gym" | "home";
export type ProgramLevel = "beginner" | "intermediate" | "advanced";

export const GOAL_LABEL: Record<ProgramGoal, string> = {
  beginner: "Dasar",
  hypertrophy: "Massa otot",
  strength: "Kekuatan",
  fat_loss: "Bakar lemak / HIIT",
  calisthenics: "Calisthenics",
  glutes: "Glutes & kaki",
  cardio: "Kardio",
  mobility: "Mobilitas",
};
export const PLACE_LABEL: Record<ProgramPlace, string> = { gym: "Gym", home: "Rumah" };
export const LEVEL_LABEL: Record<ProgramLevel, string> = { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjut" };

export type ProgramTemplate = {
  key: string;
  name: string;
  description: string;
  split: Split;
  goal: ProgramGoal;
  place: ProgramPlace;
  level: ProgramLevel;
  /** Rough session length, for choosing. */
  minutes: number;
  days: { name: string; weekdays: number[]; exercises: TemplateExercise[] }[];
};

const ex = (exerciseId: string, sets: number, repMin: number, repMax: number, restSeconds = 90): TemplateExercise => ({
  exerciseId,
  sets,
  repMin,
  repMax,
  restSeconds,
});
const day = (name: string, weekdays: number[], exercises: TemplateExercise[]) => ({ name, weekdays, exercises });

// Weekdays: 0 = Minggu, 1 = Senin … 6 = Sabtu.
export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  // ---------- Pemula ----------
  {
    key: "fb2",
    name: "Full Body 2×/minggu",
    description: "Untuk pemula atau jadwal padat. Dua sesi seluruh tubuh dengan jeda minimal 2 hari.",
    split: "full_body",
    goal: "beginner",
    place: "gym",
    level: "beginner",
    minutes: 45,
    days: [
      day("Full Body A", [1], [ex("ex-goblet-squat", 3, 8, 12), ex("ex-db-bench", 3, 8, 12), ex("ex-db-row", 3, 8, 12), ex("ex-db-rdl", 2, 10, 12), ex("ex-plank", 2, 30, 45, 60)]),
      day("Full Body B", [4], [ex("ex-split-squat", 3, 8, 12), ex("ex-db-shoulder", 3, 8, 12), ex("ex-lat-pulldown", 3, 8, 12), ex("ex-glute-bridge", 3, 10, 15), ex("ex-dead-bug", 2, 8, 12, 60)]),
    ],
  },
  {
    key: "gym-machine",
    name: "Pemula Gym — Mesin",
    description: "Hari pertama di gym? Mesin dan cable lebih mudah dipelajari dan aman. 3 sesi seluruh tubuh, teknik dulu, beban naik pelan.",
    split: "full_body",
    goal: "beginner",
    place: "gym",
    level: "beginner",
    minutes: 50,
    days: [
      day("Mesin A", [1], [ex("ex-leg-press", 3, 10, 12), ex("ex-machine-chest-press", 3, 10, 12), ex("ex-lat-pulldown", 3, 10, 12), ex("ex-leg-curl", 2, 10, 15), ex("ex-plank", 2, 20, 40, 60), ex("ex-treadmill-walk", 1, 10, 15, 0)]),
      day("Mesin B", [3], [ex("ex-leg-extension", 2, 12, 15), ex("ex-machine-shoulder-press", 3, 10, 12), ex("ex-cable-row", 3, 10, 12), ex("ex-back-extension", 2, 10, 15), ex("ex-triceps-pushdown", 2, 12, 15, 60), ex("ex-bike", 1, 10, 15, 0)]),
      day("Mesin C", [5], [ex("ex-goblet-squat", 3, 8, 12), ex("ex-assisted-pullup", 3, 6, 10), ex("ex-db-bench", 3, 8, 12), ex("ex-calf-raise", 2, 12, 15, 60), ex("ex-cable-curl", 2, 12, 15, 60), ex("ex-dead-bug", 2, 8, 12, 60)]),
    ],
  },
  {
    key: "home-db3",
    name: "Rumah — Dumbbell 3×",
    description: "Cukup sepasang dumbbell (adjustable lebih baik) dan lantai. Seluruh tubuh tiga kali seminggu.",
    split: "full_body",
    goal: "beginner",
    place: "home",
    level: "beginner",
    minutes: 40,
    days: [
      day("Rumah A", [1], [ex("ex-goblet-squat", 3, 10, 15), ex("ex-pushup", 3, 6, 15), ex("ex-db-row", 3, 10, 12), ex("ex-db-rdl", 3, 10, 12), ex("ex-plank", 2, 30, 45, 45)]),
      day("Rumah B", [3], [ex("ex-reverse-lunge", 3, 8, 12), ex("ex-db-shoulder", 3, 8, 12), ex("ex-band-row", 3, 12, 15), ex("ex-glute-bridge", 3, 12, 15), ex("ex-dead-bug", 2, 8, 12, 45)]),
      day("Rumah C", [5], [ex("ex-split-squat", 3, 8, 12), ex("ex-db-bench", 3, 8, 12), ex("ex-db-row", 3, 8, 12), ex("ex-lateral-raise", 2, 12, 15, 60), ex("ex-biceps-curl", 2, 10, 15, 60), ex("ex-hollow-hold", 2, 20, 30, 45)]),
    ],
  },
  {
    key: "band-travel",
    name: "Minimalis — Band & Bodyweight",
    description: "Untuk di rumah, kos, atau saat traveling. Hanya resistance band dan berat badan.",
    split: "full_body",
    goal: "beginner",
    place: "home",
    level: "beginner",
    minutes: 30,
    days: [
      day("Minimalis A", [1, 4], [ex("ex-bw-squat", 3, 15, 20, 60), ex("ex-pushup", 3, 6, 15), ex("ex-band-row", 3, 12, 20, 60), ex("ex-glute-bridge", 3, 12, 20, 60), ex("ex-band-pull-apart", 2, 15, 20, 45), ex("ex-plank", 2, 30, 45, 45)]),
      day("Minimalis B", [2, 6], [ex("ex-reverse-lunge", 3, 10, 12, 60), ex("ex-pike-pushup", 3, 6, 10), ex("ex-inverted-row", 3, 6, 12), ex("ex-wall-sit", 2, 30, 45, 60), ex("ex-shoulder-dislocate", 2, 10, 12, 30), ex("ex-bird-dog", 2, 8, 10, 30)]),
    ],
  },

  // ---------- Hipertrofi ----------
  {
    key: "fb3",
    name: "Full Body 3×/minggu",
    description: "Frekuensi tinggi per otot. Rotasi A/B/C, cocok untuk pemula–menengah.",
    split: "full_body",
    goal: "hypertrophy",
    place: "gym",
    level: "beginner",
    minutes: 60,
    days: [
      day("Full Body A", [1], [ex("ex-back-squat", 3, 5, 8, 150), ex("ex-db-bench", 3, 8, 10), ex("ex-cable-row", 3, 8, 12), ex("ex-lateral-raise", 2, 12, 15, 60)]),
      day("Full Body B", [3], [ex("ex-rdl", 3, 6, 10, 150), ex("ex-db-shoulder", 3, 8, 10), ex("ex-lat-pulldown", 3, 8, 12), ex("ex-lunge", 2, 10, 12), ex("ex-biceps-curl", 2, 10, 15, 60)]),
      day("Full Body C", [5], [ex("ex-leg-press", 3, 10, 12), ex("ex-incline-db", 3, 8, 12), ex("ex-db-row", 3, 8, 12), ex("ex-hip-thrust", 3, 8, 12), ex("ex-triceps-pushdown", 2, 10, 15, 60)]),
    ],
  },
  {
    key: "ul4",
    name: "Upper/Lower 4×/minggu",
    description: "Volume lebih tinggi untuk level menengah. Dua upper dan dua lower.",
    split: "upper_lower",
    goal: "hypertrophy",
    place: "gym",
    level: "intermediate",
    minutes: 65,
    days: [
      day("Upper 1", [1], [ex("ex-bench", 4, 5, 8, 150), ex("ex-barbell-row", 4, 6, 10, 120), ex("ex-db-shoulder", 3, 8, 12), ex("ex-lat-pulldown", 3, 8, 12), ex("ex-triceps-pushdown", 2, 10, 15, 60)]),
      day("Lower 1", [2], [ex("ex-back-squat", 4, 5, 8, 180), ex("ex-rdl", 3, 6, 10, 150), ex("ex-leg-curl", 3, 10, 12), ex("ex-calf-raise", 3, 10, 15, 60), ex("ex-plank", 2, 30, 60, 60)]),
      day("Upper 2", [4], [ex("ex-ohp", 3, 6, 8, 150), ex("ex-pullup", 3, 6, 10, 120), ex("ex-incline-db", 3, 8, 12), ex("ex-cable-row", 3, 10, 12), ex("ex-face-pull", 3, 12, 15, 60), ex("ex-biceps-curl", 2, 10, 15, 60)]),
      day("Lower 2", [5], [ex("ex-deadlift", 3, 3, 5, 180), ex("ex-split-squat", 3, 8, 12), ex("ex-hip-thrust", 3, 8, 12), ex("ex-leg-press", 2, 10, 15), ex("ex-dead-bug", 2, 8, 12, 60)]),
    ],
  },
  {
    key: "ppl3",
    name: "Push/Pull/Legs 3×",
    description: "Setiap otot dilatih sekali seminggu dengan volume cukup. Bisa diulang 2× seminggu bila sudah terbiasa.",
    split: "push_pull_legs",
    goal: "hypertrophy",
    place: "gym",
    level: "intermediate",
    minutes: 60,
    days: [
      day("Push", [1], [ex("ex-bench", 4, 6, 10, 150), ex("ex-incline-db", 3, 8, 12), ex("ex-db-shoulder", 3, 8, 12), ex("ex-lateral-raise", 3, 12, 15, 60), ex("ex-triceps-pushdown", 3, 10, 15, 60)]),
      day("Pull", [3], [ex("ex-pullup", 3, 6, 10, 120), ex("ex-barbell-row", 3, 6, 10, 120), ex("ex-cable-row", 3, 10, 12), ex("ex-face-pull", 3, 12, 15, 60), ex("ex-hammer-curl", 3, 10, 12, 60)]),
      day("Legs", [5], [ex("ex-back-squat", 4, 6, 8, 180), ex("ex-rdl", 3, 8, 10, 150), ex("ex-leg-press", 3, 10, 12), ex("ex-leg-curl", 3, 10, 12), ex("ex-calf-raise", 3, 10, 15, 60)]),
    ],
  },
  {
    key: "ppl6",
    name: "Push/Pull/Legs 6×",
    description: "Volume tinggi untuk yang sudah konsisten ≥1 tahun dan pemulihannya baik. Dua variasi tiap hari.",
    split: "push_pull_legs",
    goal: "hypertrophy",
    place: "gym",
    level: "advanced",
    minutes: 70,
    days: [
      day("Push A", [1], [ex("ex-bench", 4, 5, 8, 150), ex("ex-ohp", 3, 6, 10, 120), ex("ex-incline-db", 3, 8, 12), ex("ex-cable-lateral", 3, 12, 15, 60), ex("ex-overhead-triceps", 3, 10, 12, 60)]),
      day("Pull A", [2], [ex("ex-deadlift", 3, 3, 5, 180), ex("ex-pullup", 4, 6, 10, 120), ex("ex-chest-supported-row", 3, 8, 12), ex("ex-face-pull", 3, 12, 15, 60), ex("ex-barbell-curl", 3, 8, 12, 60)]),
      day("Legs A", [3], [ex("ex-back-squat", 4, 5, 8, 180), ex("ex-rdl", 3, 8, 10, 150), ex("ex-leg-extension", 3, 12, 15), ex("ex-leg-curl", 3, 10, 12), ex("ex-calf-raise", 4, 10, 15, 60)]),
      day("Push B", [4], [ex("ex-db-bench", 4, 8, 12), ex("ex-machine-shoulder-press", 3, 8, 12), ex("ex-dips", 3, 8, 12), ex("ex-lateral-raise", 4, 12, 20, 60), ex("ex-triceps-pushdown", 3, 12, 15, 60)]),
      day("Pull B", [5], [ex("ex-barbell-row", 4, 6, 10, 120), ex("ex-lat-pulldown", 3, 10, 12), ex("ex-straight-arm-pulldown", 3, 12, 15, 60), ex("ex-cable-row", 3, 10, 12), ex("ex-hammer-curl", 3, 10, 12, 60)]),
      day("Legs B", [6], [ex("ex-front-squat", 3, 6, 8, 180), ex("ex-hip-thrust", 3, 8, 12), ex("ex-split-squat", 3, 8, 12), ex("ex-leg-press", 3, 12, 15), ex("ex-hanging-knee-raise", 3, 10, 15, 60)]),
    ],
  },
  {
    key: "bro5",
    name: "Split per Otot 5×",
    description: "Klasik bodybuilding: satu kelompok otot per hari dengan banyak variasi. Cocok bila suka sesi fokus.",
    split: "body_part",
    goal: "hypertrophy",
    place: "gym",
    level: "intermediate",
    minutes: 60,
    days: [
      day("Dada", [1], [ex("ex-bench", 4, 6, 10, 150), ex("ex-incline-db", 3, 8, 12), ex("ex-machine-chest-press", 3, 10, 12), ex("ex-dips", 3, 8, 12), ex("ex-pushup", 2, 10, 20, 60)]),
      day("Punggung", [2], [ex("ex-pullup", 4, 6, 10, 120), ex("ex-barbell-row", 3, 6, 10, 120), ex("ex-lat-pulldown", 3, 10, 12), ex("ex-cable-row", 3, 10, 12), ex("ex-back-extension", 3, 10, 15, 60)]),
      day("Kaki", [3], [ex("ex-back-squat", 4, 6, 10, 180), ex("ex-leg-press", 3, 10, 12), ex("ex-rdl", 3, 8, 10, 150), ex("ex-leg-extension", 3, 12, 15), ex("ex-leg-curl", 3, 10, 12), ex("ex-calf-raise", 4, 10, 15, 60)]),
      day("Bahu", [4], [ex("ex-ohp", 4, 6, 10, 150), ex("ex-lateral-raise", 4, 12, 15, 60), ex("ex-cable-lateral", 3, 12, 15, 60), ex("ex-front-raise", 2, 10, 12, 60), ex("ex-face-pull", 3, 12, 15, 60)]),
      day("Lengan & Core", [5], [ex("ex-barbell-curl", 3, 8, 12, 60), ex("ex-skullcrusher", 3, 8, 12, 60), ex("ex-hammer-curl", 3, 10, 12, 60), ex("ex-triceps-pushdown", 3, 10, 15, 60), ex("ex-cable-curl", 2, 12, 15, 60), ex("ex-cable-crunch", 3, 10, 15, 60), ex("ex-hanging-knee-raise", 3, 10, 15, 60)]),
    ],
  },
  {
    key: "home-ul4",
    name: "Rumah — Upper/Lower 4×",
    description: "Dumbbell, band, dan bangku/kursi kokoh. Volume menengah tanpa ke gym.",
    split: "upper_lower",
    goal: "hypertrophy",
    place: "home",
    level: "intermediate",
    minutes: 50,
    days: [
      day("Upper 1", [1], [ex("ex-db-bench", 4, 8, 12), ex("ex-db-row", 4, 8, 12), ex("ex-db-shoulder", 3, 8, 12), ex("ex-band-pull-apart", 3, 15, 20, 45), ex("ex-overhead-triceps", 3, 10, 12, 60)]),
      day("Lower 1", [2], [ex("ex-goblet-squat", 4, 10, 15), ex("ex-db-rdl", 4, 8, 12), ex("ex-step-up", 3, 10, 12), ex("ex-calf-raise", 3, 15, 20, 45), ex("ex-dead-bug", 3, 8, 12, 45)]),
      day("Upper 2", [4], [ex("ex-incline-db", 3, 8, 12), ex("ex-inverted-row", 3, 6, 12), ex("ex-pike-pushup", 3, 6, 10), ex("ex-lateral-raise", 3, 12, 15, 60), ex("ex-hammer-curl", 3, 10, 12, 60)]),
      day("Lower 2", [5], [ex("ex-split-squat", 3, 8, 12), ex("ex-single-leg-rdl", 3, 8, 10), ex("ex-hip-thrust", 3, 10, 15), ex("ex-wall-sit", 2, 40, 60, 60), ex("ex-hollow-hold", 3, 20, 30, 45)]),
    ],
  },

  // ---------- Kekuatan ----------
  {
    key: "sl5x5",
    name: "Kekuatan 5×5",
    description: "Program barbell sederhana: dua sesi A/B bergantian 3× seminggu, naik beban sedikit tiap sesi selama teknik terjaga.",
    split: "full_body",
    goal: "strength",
    place: "gym",
    level: "beginner",
    minutes: 60,
    days: [
      day("Sesi A", [1, 5], [ex("ex-back-squat", 5, 5, 5, 180), ex("ex-bench", 5, 5, 5, 180), ex("ex-barbell-row", 5, 5, 5, 150), ex("ex-plank", 2, 30, 60, 60)]),
      day("Sesi B", [3], [ex("ex-back-squat", 5, 5, 5, 180), ex("ex-ohp", 5, 5, 5, 180), ex("ex-deadlift", 1, 5, 5, 180), ex("ex-chinup", 3, 5, 8, 120)]),
    ],
  },
  {
    key: "strength-ul",
    name: "Kekuatan Upper/Lower 4×",
    description: "Satu lift berat (3–5 rep) per sesi plus aksesori. Untuk yang sudah menguasai teknik barbell.",
    split: "upper_lower",
    goal: "strength",
    place: "gym",
    level: "advanced",
    minutes: 75,
    days: [
      day("Upper berat", [1], [ex("ex-bench", 5, 3, 5, 210), ex("ex-barbell-row", 4, 5, 6, 150), ex("ex-ohp", 3, 6, 8, 150), ex("ex-pullup", 3, 6, 8, 120), ex("ex-skullcrusher", 2, 8, 10, 60)]),
      day("Lower berat", [2], [ex("ex-back-squat", 5, 3, 5, 240), ex("ex-rdl", 3, 6, 8, 150), ex("ex-split-squat", 3, 8, 10), ex("ex-farmer-carry", 3, 30, 45, 90), ex("ex-hanging-knee-raise", 3, 10, 12, 60)]),
      day("Upper volume", [4], [ex("ex-ohp", 4, 3, 5, 210), ex("ex-incline-db", 3, 8, 10), ex("ex-chest-supported-row", 3, 8, 10), ex("ex-dips", 3, 6, 10, 120), ex("ex-face-pull", 3, 12, 15, 60)]),
      day("Lower volume", [5], [ex("ex-deadlift", 4, 2, 4, 240), ex("ex-front-squat", 3, 5, 6, 180), ex("ex-hip-thrust", 3, 6, 8, 120), ex("ex-back-extension", 3, 10, 12, 60), ex("ex-plank", 3, 45, 60, 60)]),
    ],
  },

  // ---------- Glutes ----------
  {
    key: "glutes3",
    name: "Glutes & Kaki 3×",
    description: "Fokus bokong dan paha, plus satu sesi upper ringan agar tetap seimbang.",
    split: "custom",
    goal: "glutes",
    place: "gym",
    level: "intermediate",
    minutes: 55,
    days: [
      day("Glute berat", [1], [ex("ex-hip-thrust", 4, 6, 10, 120), ex("ex-rdl", 3, 8, 10, 150), ex("ex-split-squat", 3, 8, 12), ex("ex-cable-kickback", 3, 12, 15, 60), ex("ex-dead-bug", 2, 8, 12, 45)]),
      day("Upper + core", [3], [ex("ex-lat-pulldown", 3, 10, 12), ex("ex-db-shoulder", 3, 8, 12), ex("ex-cable-row", 3, 10, 12), ex("ex-db-bench", 3, 8, 12), ex("ex-plank", 2, 30, 60, 60)]),
      day("Glute volume", [5], [ex("ex-goblet-squat", 3, 10, 15), ex("ex-glute-bridge", 3, 12, 20, 60), ex("ex-step-up", 3, 10, 12), ex("ex-back-extension", 3, 12, 15, 60), ex("ex-leg-curl", 3, 10, 15, 60)]),
    ],
  },
  {
    key: "glutes-home",
    name: "Glutes di Rumah",
    description: "Dumbbell, band, dan bangku. Tiga sesi fokus bokong dan paha belakang.",
    split: "custom",
    goal: "glutes",
    place: "home",
    level: "beginner",
    minutes: 40,
    days: [
      day("Glutes A", [1], [ex("ex-hip-thrust", 4, 10, 15), ex("ex-db-rdl", 3, 10, 12), ex("ex-reverse-lunge", 3, 10, 12), ex("ex-glute-bridge", 2, 15, 20, 45)]),
      day("Glutes B", [3], [ex("ex-split-squat", 3, 8, 12), ex("ex-single-leg-rdl", 3, 8, 10), ex("ex-step-up", 3, 10, 12), ex("ex-bird-dog", 2, 8, 10, 30)]),
      day("Glutes C", [5], [ex("ex-goblet-squat", 3, 12, 15), ex("ex-kb-swing", 4, 12, 15, 60), ex("ex-hip-thrust", 3, 12, 15), ex("ex-wall-sit", 2, 40, 60, 60)]),
    ],
  },

  // ---------- Calisthenics ----------
  {
    key: "cali-beginner",
    name: "Calisthenics Pemula",
    description: "Hanya berat badan (dan pull-up bar bila ada). Bangun dasar push, pull, squat, dan core.",
    split: "full_body",
    goal: "calisthenics",
    place: "home",
    level: "beginner",
    minutes: 35,
    days: [
      day("Dasar A", [1], [ex("ex-knee-pushup", 3, 8, 15), ex("ex-inverted-row", 3, 6, 10), ex("ex-bw-squat", 3, 15, 20, 60), ex("ex-glute-bridge", 3, 12, 15, 60), ex("ex-plank", 3, 20, 40, 45)]),
      day("Dasar B", [3], [ex("ex-pushup", 3, 5, 12), ex("ex-bench-dip", 3, 8, 12), ex("ex-reverse-lunge", 3, 8, 12, 60), ex("ex-dead-bug", 3, 8, 12, 45), ex("ex-hollow-hold", 3, 15, 30, 45)]),
      day("Dasar C", [5], [ex("ex-pike-pushup", 3, 5, 10), ex("ex-inverted-row", 3, 8, 12), ex("ex-split-squat", 3, 8, 10), ex("ex-leg-raise", 3, 8, 12, 45), ex("ex-wall-sit", 2, 30, 60, 60)]),
    ],
  },
  {
    key: "cali-intermediate",
    name: "Calisthenics Menengah 4×",
    description: "Pull-up, dips, dan variasi push-up dengan volume lebih tinggi. Butuh pull-up bar dan dip bar/kursi kokoh.",
    split: "upper_lower",
    goal: "calisthenics",
    place: "home",
    level: "intermediate",
    minutes: 45,
    days: [
      day("Pull + core", [1], [ex("ex-pullup", 5, 4, 8, 120), ex("ex-chinup", 3, 5, 8, 120), ex("ex-inverted-row", 3, 10, 15), ex("ex-hanging-knee-raise", 3, 10, 15, 60)]),
      day("Kaki", [2], [ex("ex-split-squat", 4, 10, 15), ex("ex-jump-squat", 3, 8, 12), ex("ex-single-leg-rdl", 3, 10, 12), ex("ex-wall-sit", 3, 45, 60, 60)]),
      day("Push + core", [4], [ex("ex-dips", 4, 6, 12, 120), ex("ex-pike-pushup", 4, 6, 10), ex("ex-pushup", 3, 12, 20), ex("ex-hollow-hold", 3, 30, 45, 45)]),
      day("Skill & conditioning", [6], [ex("ex-burpee", 3, 8, 12), ex("ex-pullup", 3, 3, 6, 120), ex("ex-box-jump", 3, 5, 8), ex("ex-mountain-climber", 3, 30, 40, 30)]),
    ],
  },

  // ---------- Fat loss / HIIT ----------
  {
    key: "hiit-home",
    name: "HIIT Rumah 3×",
    description: "Circuit berbasis waktu: kerja 40 detik, istirahat 20 detik, ulangi putaran. Tanpa alat, 20–25 menit.",
    split: "circuit",
    goal: "fat_loss",
    place: "home",
    level: "beginner",
    minutes: 25,
    days: [
      day("HIIT A", [1], [ex("ex-jumping-jack", 3, 40, 40, 20), ex("ex-bw-squat", 3, 15, 20, 20), ex("ex-mountain-climber", 3, 30, 40, 20), ex("ex-pushup", 3, 8, 12, 20), ex("ex-high-knees", 3, 30, 40, 60)]),
      day("HIIT B", [3], [ex("ex-high-knees", 3, 40, 40, 20), ex("ex-reverse-lunge", 3, 10, 12, 20), ex("ex-burpee", 3, 6, 10, 20), ex("ex-plank", 3, 30, 40, 20), ex("ex-jump-rope", 3, 45, 60, 60)]),
      day("HIIT C", [5], [ex("ex-jump-squat", 3, 10, 12, 20), ex("ex-jumping-jack", 3, 40, 40, 20), ex("ex-knee-pushup", 3, 10, 15, 20), ex("ex-mountain-climber", 3, 30, 40, 20), ex("ex-hollow-hold", 3, 20, 30, 60)]),
    ],
  },
  {
    key: "fatloss-gym",
    name: "Fat Loss Gym — Beban + Kardio",
    description: "Pertahankan otot saat defisit kalori: beban seluruh tubuh, finisher circuit, dan kardio ringan.",
    split: "circuit",
    goal: "fat_loss",
    place: "gym",
    level: "intermediate",
    minutes: 55,
    days: [
      day("Beban + rower", [1], [ex("ex-goblet-squat", 3, 10, 12, 60), ex("ex-db-bench", 3, 10, 12, 60), ex("ex-cable-row", 3, 10, 12, 60), ex("ex-kb-swing", 3, 15, 20, 45), ex("ex-rower", 1, 10, 15, 0)]),
      day("Circuit", [3], [ex("ex-thruster", 4, 10, 12, 45), ex("ex-db-row", 4, 10, 12, 45), ex("ex-step-up", 4, 10, 12, 45), ex("ex-mountain-climber", 4, 30, 40, 45), ex("ex-bike", 1, 15, 20, 0)]),
      day("Beban + incline walk", [5], [ex("ex-rdl", 3, 8, 10, 90), ex("ex-lat-pulldown", 3, 10, 12, 60), ex("ex-db-shoulder", 3, 10, 12, 60), ex("ex-farmer-carry", 3, 30, 45, 60), ex("ex-treadmill-walk", 1, 20, 30, 0)]),
    ],
  },
  {
    key: "kb-home",
    name: "Kettlebell Conditioning",
    description: "Satu kettlebell untuk kekuatan dan kardio sekaligus. Swing adalah gerakan inti — pelajari tekniknya dulu.",
    split: "circuit",
    goal: "fat_loss",
    place: "home",
    level: "intermediate",
    minutes: 30,
    days: [
      day("KB A", [1, 4], [ex("ex-kb-swing", 5, 15, 20, 45), ex("ex-goblet-squat", 4, 10, 12, 45), ex("ex-pushup", 4, 8, 15, 45), ex("ex-farmer-carry", 3, 30, 45, 45)]),
      day("KB B", [2, 6], [ex("ex-kb-swing", 5, 15, 20, 45), ex("ex-reverse-lunge", 3, 10, 12, 45), ex("ex-db-row", 3, 10, 12, 45), ex("ex-mountain-climber", 3, 30, 40, 30)]),
    ],
  },

  // ---------- Kardio ----------
  {
    key: "cardio-z2",
    name: "Kardio Zona 2 + Interval",
    description: "Tiga sesi santai (masih bisa ngobrol) membangun daya tahan, plus satu sesi interval. Pilih mesin mana pun.",
    split: "custom",
    goal: "cardio",
    place: "gym",
    level: "beginner",
    minutes: 40,
    days: [
      day("Zona 2 — jalan incline", [1], [ex("ex-treadmill-walk", 1, 30, 45, 0)]),
      day("Zona 2 — sepeda", [3], [ex("ex-bike", 1, 30, 45, 0)]),
      day("Interval", [5], [ex("ex-bike", 1, 5, 5, 0), ex("ex-rower", 6, 1, 1, 90), ex("ex-treadmill-walk", 1, 5, 10, 0)]),
      day("Zona 2 — panjang", [6], [ex("ex-treadmill-run", 1, 30, 60, 0)]),
    ],
  },
  {
    key: "cardio-home",
    name: "Kardio di Rumah",
    description: "Lompat tali dan gerakan berat badan. Intensitas naik pelan; cocok saat tidak ke gym.",
    split: "circuit",
    goal: "cardio",
    place: "home",
    level: "beginner",
    minutes: 25,
    days: [
      day("Tali & langkah", [2], [ex("ex-jump-rope", 6, 45, 60, 45), ex("ex-high-knees", 3, 30, 30, 30), ex("ex-jumping-jack", 3, 45, 60, 30)]),
      day("Cardio circuit", [4], [ex("ex-jumping-jack", 4, 45, 45, 15), ex("ex-bw-squat", 4, 15, 20, 15), ex("ex-mountain-climber", 4, 30, 30, 15), ex("ex-jump-rope", 4, 60, 60, 60)]),
      day("Daya tahan", [6], [ex("ex-jump-rope", 8, 60, 90, 45), ex("ex-step-up", 3, 15, 20, 30)]),
    ],
  },

  // ---------- Mobilitas ----------
  {
    key: "mobility-daily",
    name: "Mobilitas Harian 15 Menit",
    description: "Rangkaian ringan untuk punggung, pinggul, dan bahu. Bisa tiap hari atau sebagai pemanasan/pendinginan.",
    split: "custom",
    goal: "mobility",
    place: "home",
    level: "beginner",
    minutes: 15,
    days: [
      day("Mobilitas", [0, 1, 2, 3, 4, 5, 6], [
        ex("ex-cat-cow", 1, 45, 60, 0),
        ex("ex-childs-pose", 1, 45, 60, 0),
        ex("ex-downward-dog", 1, 30, 45, 0),
        ex("ex-cobra", 1, 30, 45, 0),
        ex("ex-hip-flexor-stretch", 2, 30, 45, 0),
        ex("ex-hamstring-stretch", 1, 45, 60, 0),
        ex("ex-quad-stretch", 2, 30, 30, 0),
        ex("ex-deep-squat-hold", 1, 45, 60, 0),
        ex("ex-shoulder-dislocate", 2, 10, 12, 0),
      ]),
    ],
  },
  {
    key: "mobility-desk",
    name: "Pemulihan Kerja Duduk",
    description: "Untuk yang banyak duduk: buka pinggul, dada, dan punggung atas, plus aktivasi glutes dan core. 3× seminggu.",
    split: "custom",
    goal: "mobility",
    place: "home",
    level: "beginner",
    minutes: 20,
    days: [
      day("Buka pinggul & dada", [1, 3, 5], [
        ex("ex-cat-cow", 1, 45, 60, 0),
        ex("ex-hip-flexor-stretch", 2, 45, 60, 0),
        ex("ex-glute-bridge", 2, 12, 15, 30),
        ex("ex-band-pull-apart", 2, 15, 20, 30),
        ex("ex-bird-dog", 2, 8, 10, 30),
        ex("ex-dead-bug", 2, 8, 10, 30),
        ex("ex-cobra", 1, 30, 45, 0),
        ex("ex-childs-pose", 1, 60, 60, 0),
      ]),
    ],
  },
];

export const daysPerWeek = (t: ProgramTemplate) => new Set(t.days.flatMap((d) => d.weekdays)).size || t.days.length;
