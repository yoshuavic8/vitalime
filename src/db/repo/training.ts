import { db } from "../db";
import type { Equipment, Exercise, ExerciseMetric, ProgramDay, ProgramExercise, TrainingProgram, WorkoutSession, WorkoutSet } from "../types";
import { newId } from "../../lib/id";
import { nowIso, todayLocal } from "../../lib/date";
import { EXERCISE_SEED } from "../../data/exercises";
import { daysPerWeek, PROGRAM_TEMPLATES } from "../../data/programTemplates";
import { defaultTargets, metricOf } from "../../lib/sets";

/** Keeps built-in exercises in sync with the app version; user-made custom exercises are never touched. */
export async function ensureExerciseSeed() {
  const now = nowIso();
  const existing = new Map((await db.exerciseLibrary.toArray()).map((e) => [e.id, e]));
  await db.exerciseLibrary.bulkPut(
    EXERCISE_SEED.map((e) => ({ ...e, isCustom: false, createdAt: existing.get(e.id)?.createdAt ?? now })),
  );
}

export async function listExercises(): Promise<Exercise[]> {
  return db.exerciseLibrary.orderBy("name").toArray();
}

export async function exerciseMap(): Promise<Record<string, Exercise>> {
  const all = await db.exerciseLibrary.toArray();
  return Object.fromEntries(all.map((e) => [e.id, e]));
}

export async function saveCustomExercise(input: Omit<Exercise, "id" | "createdAt" | "isCustom">) {
  const id = newId();
  await db.exerciseLibrary.add({ ...input, id, isCustom: true, createdAt: nowIso() });
  return id;
}

// ---- Programs --------------------------------------------------------------

export type ProgramDetail = {
  program: TrainingProgram;
  days: { day: ProgramDay; exercises: ProgramExercise[] }[];
};

export async function listPrograms(): Promise<TrainingProgram[]> {
  const all = await db.trainingPrograms.toArray();
  return all
    .filter((p) => p.status !== "archived")
    .sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : b.updatedAt.localeCompare(a.updatedAt)));
}

export async function getActiveProgram() {
  return db.trainingPrograms.where("status").equals("active").first();
}

export async function getProgramDetail(programId: string): Promise<ProgramDetail | undefined> {
  const program = await db.trainingPrograms.get(programId);
  if (!program) return undefined;
  const days = await db.programDays.where("programId").equals(programId).sortBy("order");
  const exercises = await db.programExercises.where("programDayId").anyOf(days.map((d) => d.id)).toArray();
  return {
    program,
    days: days.map((day) => ({
      day,
      exercises: exercises.filter((e) => e.programDayId === day.id).sort((a, b) => a.order - b.order),
    })),
  };
}

async function activate(programId: string) {
  await db.trainingPrograms.where("status").equals("active").modify({ status: "inactive" });
  await db.trainingPrograms.update(programId, { status: "active", updatedAt: nowIso() });
}

export async function createProgramFromTemplate(key: string): Promise<string> {
  const t = PROGRAM_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error("Template tidak ditemukan");
  const now = nowIso();
  const programId = newId();
  await db.transaction("rw", db.trainingPrograms, db.programDays, db.programExercises, async () => {
    await db.trainingPrograms.add({
      id: programId,
      name: t.name,
      goal: t.description,
      split: t.split,
      daysPerWeek: daysPerWeek(t),
      startDate: todayLocal(),
      status: "inactive",
      deloadActive: false,
      createdAt: now,
      updatedAt: now,
    });
    for (const [i, d] of t.days.entries()) {
      const dayId = newId();
      await db.programDays.add({ id: dayId, programId, name: d.name, order: i, weekdays: d.weekdays });
      await db.programExercises.bulkAdd(
        d.exercises.map((e, j) => ({
          id: newId(),
          programDayId: dayId,
          exerciseId: e.exerciseId,
          order: j,
          targetSets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          restSeconds: e.restSeconds,
        })),
      );
    }
    await activate(programId);
  });
  return programId;
}

export async function createBlankProgram(name: string): Promise<string> {
  const now = nowIso();
  const programId = newId();
  await db.transaction("rw", db.trainingPrograms, db.programDays, async () => {
    await db.trainingPrograms.add({
      id: programId,
      name,
      split: "custom",
      daysPerWeek: 1,
      startDate: todayLocal(),
      status: "inactive",
      deloadActive: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.programDays.add({ id: newId(), programId, name: "Hari 1", order: 0, weekdays: [] });
    await activate(programId);
  });
  return programId;
}

export async function updateProgram(id: string, patch: Partial<TrainingProgram>) {
  await db.trainingPrograms.update(id, { ...patch, updatedAt: nowIso() });
}

export async function setActiveProgram(id: string) {
  await db.transaction("rw", db.trainingPrograms, () => activate(id));
}

/** Programs are archived, not deleted, so past sessions keep their context. */
export async function archiveProgram(id: string) {
  await updateProgram(id, { status: "archived" });
}

export async function addProgramDay(programId: string) {
  const days = await db.programDays.where("programId").equals(programId).toArray();
  await db.programDays.add({
    id: newId(),
    programId,
    name: `Hari ${days.length + 1}`,
    order: days.length,
    weekdays: [],
  });
  await updateProgram(programId, { daysPerWeek: days.length + 1 });
}

export async function updateProgramDay(id: string, patch: Partial<ProgramDay>) {
  await db.programDays.update(id, patch);
}

export async function deleteProgramDay(id: string) {
  await db.transaction("rw", db.programDays, db.programExercises, async () => {
    await db.programExercises.where("programDayId").equals(id).delete();
    await db.programDays.delete(id);
  });
}

export async function addProgramExercise(programDayId: string, exerciseId: string) {
  const [count, ex] = await Promise.all([
    db.programExercises.where("programDayId").equals(programDayId).count(),
    db.exerciseLibrary.get(exerciseId),
  ]);
  await db.programExercises.add({
    id: newId(),
    programDayId,
    exerciseId,
    order: count,
    ...defaultTargets(metricOf(ex)),
  });
}

export async function updateProgramExercise(id: string, patch: Partial<ProgramExercise>) {
  await db.programExercises.update(id, patch);
}

export async function deleteProgramExercise(id: string) {
  await db.programExercises.delete(id);
}

export async function moveProgramExercise(id: string, direction: -1 | 1) {
  const pe = await db.programExercises.get(id);
  if (!pe) return;
  const siblings = await db.programExercises.where("programDayId").equals(pe.programDayId).sortBy("order");
  const idx = siblings.findIndex((s) => s.id === id);
  const swap = siblings[idx + direction];
  if (!swap) return;
  await db.transaction("rw", db.programExercises, async () => {
    await db.programExercises.update(pe.id, { order: swap.order });
    await db.programExercises.update(swap.id, { order: pe.order });
  });
}

export async function programTargetsFor(programDayId?: string): Promise<Record<string, ProgramExercise>> {
  if (!programDayId) return {};
  const pes = await db.programExercises.where("programDayId").equals(programDayId).toArray();
  return Object.fromEntries(pes.map((p) => [p.exerciseId, p]));
}

export async function scheduledDaysFor(weekday: number) {
  const program = await getActiveProgram();
  if (!program) return { program: undefined, days: [] as ProgramDay[] };
  const days = await db.programDays.where("programId").equals(program.id).sortBy("order");
  return { program, days: days.filter((d) => d.weekdays.includes(weekday)) };
}

// ---- Sessions --------------------------------------------------------------

export async function getInProgressSession() {
  return db.workoutSessions.where("status").equals("in_progress").first();
}

export async function listSessions(limit = 50) {
  return db.workoutSessions.orderBy("startedAt").reverse().limit(limit).toArray();
}

export async function listSessionsBetween(from: string, to: string) {
  return db.workoutSessions.where("localDate").between(from, to, true, true).toArray();
}

/** The most recent completed session's sets for an exercise (for "last time" hints). */
export async function lastPerformance(exerciseId: string, excludeSessionId?: string) {
  const sets = await db.workoutSets.where("exerciseId").equals(exerciseId).toArray();
  const sessionIds = [...new Set(sets.map((s) => s.sessionId))].filter((id) => id !== excludeSessionId);
  if (!sessionIds.length) return undefined;
  const sessions = (await db.workoutSessions.bulkGet(sessionIds)).filter(
    (s): s is WorkoutSession => !!s && s.status === "completed",
  );
  const last = sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (!last) return undefined;
  return {
    session: last,
    sets: sets.filter((s) => s.sessionId === last.id).sort((a, b) => a.setNumber - b.setNumber),
  };
}

export async function listSetsForSessions(sessionIds: string[]) {
  if (!sessionIds.length) return [];
  return db.workoutSets.where("sessionId").anyOf(sessionIds).toArray();
}

export async function startSession(programDayId?: string): Promise<string> {
  const existing = await getInProgressSession();
  if (existing) return existing.id;

  const now = nowIso();
  const sessionId = newId();
  const day = programDayId ? await db.programDays.get(programDayId) : undefined;
  const program = day ? await db.trainingPrograms.get(day.programId) : undefined;
  const planned = day ? await db.programExercises.where("programDayId").equals(day.id).sortBy("order") : [];
  const library = await exerciseMap();

  const sets: WorkoutSet[] = [];
  for (const pe of planned) {
    const last = await lastPerformance(pe.exerciseId);
    const lastWeight = last?.sets.filter((s) => s.completed && s.weightKg != null).at(-1)?.weightKg;
    const deload = program?.deloadActive ?? false;
    const baseWeight = metricOf(library[pe.exerciseId]) === "reps" ? (pe.targetWeightKg ?? lastWeight) : pe.targetWeightKg;
    const setCount = deload ? Math.max(1, Math.ceil(pe.targetSets / 2)) : pe.targetSets;
    for (let n = 1; n <= setCount; n++) {
      sets.push({
        id: newId(),
        sessionId,
        exerciseId: pe.exerciseId,
        exerciseOrder: pe.order,
        setNumber: n,
        targetRepMin: pe.repMin,
        targetRepMax: pe.repMax,
        weightKg: baseWeight != null ? (deload ? Math.round(baseWeight * 0.6 * 2) / 2 : baseWeight) : undefined,
        restSeconds: pe.restSeconds,
        completed: false,
        skipped: false,
        createdAt: now,
      });
    }
  }

  await db.transaction("rw", db.workoutSessions, db.workoutSets, async () => {
    await db.workoutSessions.add({
      id: sessionId,
      programId: program?.id,
      programDayId: day?.id,
      name: day?.name ?? "Sesi bebas",
      startedAt: now,
      localDate: todayLocal(),
      status: "in_progress",
      isDeload: program?.deloadActive ?? false,
      hadPain: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.workoutSets.bulkAdd(sets);
  });
  return sessionId;
}

export async function getSessionDetail(sessionId: string) {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return undefined;
  const sets = await db.workoutSets.where("sessionId").equals(sessionId).toArray();
  sets.sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber);
  const order: string[] = [];
  for (const s of sets) if (!order.includes(s.exerciseId)) order.push(s.exerciseId);
  return { session, groups: order.map((exerciseId) => ({ exerciseId, sets: sets.filter((s) => s.exerciseId === exerciseId) })) };
}

export async function updateSet(id: string, patch: Partial<WorkoutSet>) {
  await db.workoutSets.update(id, patch);
}

export async function addSet(sessionId: string, exerciseId: string) {
  const sets = await db.workoutSets.where("[sessionId+exerciseId]").equals([sessionId, exerciseId]).sortBy("setNumber");
  const prev = sets.at(-1);
  const order = prev?.exerciseOrder ?? (await db.workoutSets.where("sessionId").equals(sessionId).count());
  await db.workoutSets.add({
    id: newId(),
    sessionId,
    exerciseId,
    exerciseOrder: order,
    setNumber: (prev?.setNumber ?? 0) + 1,
    targetRepMin: prev?.targetRepMin,
    targetRepMax: prev?.targetRepMax,
    weightKg: prev?.weightKg,
    reps: prev?.reps,
    durationSec: prev?.durationSec,
    distanceKm: prev?.distanceKm,
    restSeconds: prev?.restSeconds ?? 90,
    completed: false,
    skipped: false,
    createdAt: nowIso(),
  });
}

export async function deleteSet(id: string) {
  await db.workoutSets.delete(id);
}

export async function addExerciseToSession(sessionId: string, exerciseId: string) {
  const all = await db.workoutSets.where("sessionId").equals(sessionId).toArray();
  const maxOrder = all.reduce((m, s) => Math.max(m, s.exerciseOrder), -1);
  const [last, ex] = await Promise.all([lastPerformance(exerciseId, sessionId), db.exerciseLibrary.get(exerciseId)]);
  const t = defaultTargets(metricOf(ex));
  await db.workoutSets.add({
    id: newId(),
    sessionId,
    exerciseId,
    exerciseOrder: maxOrder + 1,
    setNumber: 1,
    targetRepMin: t.repMin,
    targetRepMax: t.repMax,
    weightKg: last?.sets.at(-1)?.weightKg,
    restSeconds: t.restSeconds,
    completed: false,
    skipped: false,
    createdAt: nowIso(),
  });
}

const muscleGroup = (m: string) => m.toLowerCase().split(/[ (]/)[0];

/**
 * Replacement suggestions: listed alternatives first, then same pattern working related muscles;
 * other same-pattern moves only pad a short list. Only exercises usable with the given equipment.
 */
export function swapCandidates(from: Exercise, all: Exercise[], equipment: Equipment[]): Exercise[] {
  const fromSecondary = from.secondaryMuscles.map((m) => m.toLowerCase());
  const related = (e: Exercise) =>
    muscleGroup(e.primaryMuscle) === muscleGroup(from.primaryMuscle) ||
    e.secondaryMuscles.some((m) => m.toLowerCase() === from.primaryMuscle.toLowerCase()) ||
    fromSecondary.includes(e.primaryMuscle.toLowerCase());
  const rank = (e: Exercise) =>
    from.alternatives.includes(e.id) ? 0 : e.pattern !== from.pattern ? 3 : related(e) ? 1 : 2;
  const ranked = all
    .filter((e) => e.id !== from.id && equipment.includes(e.equipment) && rank(e) < 3)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const close = ranked.filter((e) => rank(e) < 2);
  return (close.length >= 5 ? close : ranked).slice(0, 12);
}

/** Swaps the not-yet-completed sets of an exercise for another one; completed sets stay as history. */
export async function swapSessionExercise(sessionId: string, fromId: string, toId: string) {
  const [sets, existing, to, last] = await Promise.all([
    db.workoutSets.where("[sessionId+exerciseId]").equals([sessionId, fromId]).sortBy("setNumber"),
    db.workoutSets.where("[sessionId+exerciseId]").equals([sessionId, toId]).count(),
    db.exerciseLibrary.get(toId),
    lastPerformance(toId, sessionId),
  ]);
  const pending = sets.filter((s) => !s.completed);
  if (!pending.length) return;
  const from = await db.exerciseLibrary.get(fromId);
  const sameMetric = metricOf(from) === metricOf(to);
  const t = defaultTargets(metricOf(to));
  const lastWeight = last?.sets.filter((s) => s.completed && s.weightKg != null).at(-1)?.weightKg;
  await db.transaction("rw", db.workoutSets, async () => {
    for (const [i, s] of pending.entries()) {
      await db.workoutSets.update(s.id, {
        exerciseId: toId,
        setNumber: existing + i + 1,
        weightKg: lastWeight,
        reps: undefined,
        rpe: undefined,
        durationSec: undefined,
        distanceKm: undefined,
        skipped: false,
        targetRepMin: sameMetric ? s.targetRepMin : t.repMin,
        targetRepMax: sameMetric ? s.targetRepMax : t.repMax,
      });
    }
  });
}

export async function updateSession(id: string, patch: Partial<WorkoutSession>) {
  await db.workoutSessions.update(id, { ...patch, updatedAt: nowIso() });
}

export async function finishSession(id: string, patch: Partial<WorkoutSession>) {
  await updateSession(id, { ...patch, status: "completed", endedAt: nowIso() });
}

export async function deleteSession(id: string) {
  await db.transaction("rw", db.workoutSessions, db.workoutSets, async () => {
    await db.workoutSets.where("sessionId").equals(id).delete();
    await db.workoutSessions.delete(id);
  });
}

// ---- Stats & progression ---------------------------------------------------

/** Epley estimate; only meaningful for sets of ~1–12 reps. */
export const estimate1RM = (weightKg: number, reps: number) => (reps <= 1 ? weightKg : weightKg * (1 + reps / 30));

export function setVolume(s: WorkoutSet) {
  return s.completed && s.weightKg && s.reps ? s.weightKg * s.reps : 0;
}

export async function exerciseHistory(exerciseId: string) {
  const sets = (await db.workoutSets.where("exerciseId").equals(exerciseId).toArray()).filter((s) => s.completed);
  const sessions = (await db.workoutSessions.bulkGet([...new Set(sets.map((s) => s.sessionId))])).filter(
    (s): s is WorkoutSession => !!s && s.status === "completed",
  );
  const rows = sessions
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const ss = sets.filter((s) => s.sessionId === session.id);
      const topSet = ss.reduce<WorkoutSet | undefined>(
        (best, s) => (s.weightKg != null && (best?.weightKg == null || s.weightKg > best.weightKg) ? s : best),
        undefined,
      );
      const best1rm = Math.max(0, ...ss.map((s) => (s.weightKg && s.reps ? estimate1RM(s.weightKg, s.reps) : 0)));
      const bestDuration = Math.max(0, ...ss.map((s) => s.durationSec ?? 0));
      const totalDuration = ss.reduce((v, s) => v + (s.durationSec ?? 0), 0);
      const distanceKm = ss.reduce((v, s) => v + (s.distanceKm ?? 0), 0);
      return { session, sets: ss, topSet, volume: ss.reduce((v, s) => v + setVolume(s), 0), best1rm, bestDuration, totalDuration, distanceKm };
    });
  const pbWeight = Math.max(0, ...rows.map((r) => r.topSet?.weightKg ?? 0));
  const pb1rm = Math.max(0, ...rows.map((r) => r.best1rm));
  const pbDuration = Math.max(0, ...rows.map((r) => r.bestDuration));
  const pbDistance = Math.max(0, ...rows.map((r) => r.distanceKm));
  return { rows, pbWeight, pb1rm, pbDuration, pbDistance };
}

export type ProgressionHint =
  | { kind: "increase"; message: string }
  | { kind: "hold"; message: string }
  | { kind: "caution"; message: string };

/**
 * Suggests (never applies) progression: only when every target set last time hit the top of
 * the rep range and the session wasn't flagged with pain.
 */
export function progressionHint(
  last: Awaited<ReturnType<typeof lastPerformance>>,
  target: { repMax?: number; targetSets?: number },
  metric: ExerciseMetric = "reps",
): ProgressionHint | undefined {
  if (!last) return undefined;
  if (last.session.hadPain) {
    return { kind: "caution", message: "Sesi terakhir tercatat nyeri. Pertahankan atau turunkan beban; konsultasikan bila berlanjut." };
  }
  if (last.session.isDeload) return { kind: "hold", message: "Sesi terakhir deload — kembali ke beban normal sebelumnya." };
  const done = last.sets.filter((s) => s.completed);
  if (!done.length || !target.repMax) return undefined;
  const highRpe = done.some((s) => (s.rpe ?? 0) >= 9.5);
  const enoughSets = done.length >= (target.targetSets ?? 1);
  switch (metric) {
    case "reps": {
      const allTop = enoughSets && done.every((s) => (s.reps ?? 0) >= target.repMax!);
      if (allTop && !highRpe) {
        return { kind: "increase", message: "Semua set mencapai batas atas repetisi. Pertimbangkan +2,5 kg (atau +1 repetisi) jika teknik tetap baik." };
      }
      return { kind: "hold", message: "Pertahankan beban, kejar repetisi sampai batas atas di semua set." };
    }
    case "time": {
      const allTop = enoughSets && done.every((s) => (s.durationSec ?? 0) >= target.repMax!);
      if (allTop && !highRpe) {
        return { kind: "increase", message: "Semua set mencapai target waktu. Tambah 5–10 detik atau pilih variasi yang lebih berat." };
      }
      return { kind: "hold", message: "Kejar target waktu di semua set dengan teknik rapi." };
    }
    case "cardio":
      return highRpe
        ? { kind: "hold", message: "Sesi terakhir terasa sangat berat. Pertahankan durasi/intensitas dulu." }
        : { kind: "increase", message: "Naikkan bertahap: +5 menit atau sedikit lebih cepat (maks ±10% per minggu)." };
    default: {
      const never: never = metric;
      throw new Error(`Unknown metric ${never}`);
    }
  }
}
