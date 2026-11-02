import type { Split } from "../db/types";

export type TemplateExercise = {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
};

export type ProgramTemplate = {
  key: string;
  name: string;
  description: string;
  split: Split;
  daysPerWeek: number;
  level: string;
  days: { name: string; weekdays: number[]; exercises: TemplateExercise[] }[];
};

const ex = (exerciseId: string, sets: number, repMin: number, repMax: number, restSeconds = 90): TemplateExercise => ({
  exerciseId,
  sets,
  repMin,
  repMax,
  restSeconds,
});

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    key: "fb2",
    name: "Full Body 2×/minggu",
    description: "Untuk pemula atau jadwal padat. Dua sesi seluruh tubuh dengan jeda minimal 2 hari.",
    split: "full_body",
    daysPerWeek: 2,
    level: "Pemula",
    days: [
      {
        name: "Full Body A",
        weekdays: [1],
        exercises: [ex("ex-goblet-squat", 3, 8, 12), ex("ex-db-bench", 3, 8, 12), ex("ex-db-row", 3, 8, 12), ex("ex-db-rdl", 2, 10, 12), ex("ex-plank", 2, 30, 45, 60)],
      },
      {
        name: "Full Body B",
        weekdays: [4],
        exercises: [ex("ex-split-squat", 3, 8, 12), ex("ex-db-shoulder", 3, 8, 12), ex("ex-lat-pulldown", 3, 8, 12), ex("ex-glute-bridge", 3, 10, 15), ex("ex-dead-bug", 2, 8, 12, 60)],
      },
    ],
  },
  {
    key: "fb3",
    name: "Full Body 3×/minggu",
    description: "Frekuensi tinggi per otot. Rotasi A/B/C, cocok untuk pemula-menengah.",
    split: "full_body",
    daysPerWeek: 3,
    level: "Pemula–Menengah",
    days: [
      {
        name: "Full Body A",
        weekdays: [1],
        exercises: [ex("ex-back-squat", 3, 5, 8, 150), ex("ex-db-bench", 3, 8, 10), ex("ex-cable-row", 3, 8, 12), ex("ex-lateral-raise", 2, 12, 15, 60)],
      },
      {
        name: "Full Body B",
        weekdays: [3],
        exercises: [ex("ex-rdl", 3, 6, 10, 150), ex("ex-db-shoulder", 3, 8, 10), ex("ex-lat-pulldown", 3, 8, 12), ex("ex-lunge", 2, 10, 12), ex("ex-biceps-curl", 2, 10, 15, 60)],
      },
      {
        name: "Full Body C",
        weekdays: [5],
        exercises: [ex("ex-leg-press", 3, 10, 12), ex("ex-incline-db", 3, 8, 12), ex("ex-db-row", 3, 8, 12), ex("ex-hip-thrust", 3, 8, 12), ex("ex-triceps-pushdown", 2, 10, 15, 60)],
      },
    ],
  },
  {
    key: "ul4",
    name: "Upper/Lower 4×/minggu",
    description: "Untuk level menengah yang ingin volume lebih tinggi. Dua upper dan dua lower.",
    split: "upper_lower",
    daysPerWeek: 4,
    level: "Menengah",
    days: [
      {
        name: "Upper 1",
        weekdays: [1],
        exercises: [ex("ex-bench", 4, 5, 8, 150), ex("ex-barbell-row", 4, 6, 10, 120), ex("ex-db-shoulder", 3, 8, 12), ex("ex-lat-pulldown", 3, 8, 12), ex("ex-triceps-pushdown", 2, 10, 15, 60)],
      },
      {
        name: "Lower 1",
        weekdays: [2],
        exercises: [ex("ex-back-squat", 4, 5, 8, 180), ex("ex-rdl", 3, 6, 10, 150), ex("ex-leg-curl", 3, 10, 12), ex("ex-calf-raise", 3, 10, 15, 60), ex("ex-plank", 2, 30, 60, 60)],
      },
      {
        name: "Upper 2",
        weekdays: [4],
        exercises: [ex("ex-ohp", 3, 6, 8, 150), ex("ex-pullup", 3, 6, 10, 120), ex("ex-incline-db", 3, 8, 12), ex("ex-cable-row", 3, 10, 12), ex("ex-face-pull", 3, 12, 15, 60), ex("ex-biceps-curl", 2, 10, 15, 60)],
      },
      {
        name: "Lower 2",
        weekdays: [5],
        exercises: [ex("ex-deadlift", 3, 3, 5, 180), ex("ex-split-squat", 3, 8, 12), ex("ex-hip-thrust", 3, 8, 12), ex("ex-leg-press", 2, 10, 15), ex("ex-dead-bug", 2, 8, 12, 60)],
      },
    ],
  },
];
