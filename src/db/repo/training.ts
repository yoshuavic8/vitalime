import { db } from "../db";
import type { Exercise, ProgramDay, ProgramExercise, TrainingProgram, WorkoutSession, WorkoutSet } from "../types";
import { newId } from "../../lib/id";
import { nowIso, todayLocal } from "../../lib/date";
import { EXERCISE_SEED } from "../../data/exercises";
import { PROGRAM_TEMPLATES } from "../../data/programTemplates";

/** Seeds the library once; user-made custom exercises are never overwritten. */
export async function ensureExerciseSeed() {
  const now = nowIso();
  const existing = new Set(await db.exerciseLibrary.toCollection().primaryKeys());
  const missing = EXERCISE_SEED.filter((e) => !existing.has(e.id));
  if (missing.length) {
    await db.exerciseLibrary.bulkAdd(missing.map((e) => ({ ...e, isCustom: false, createdAt: now })));
  }
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
      daysPerWeek: t.daysPerWeek,
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
  const count = await db.programExercises.where("programDayId").equals(programDayId).count();
  await db.programExercises.add({
    id: newId(),
    programDayId,
    exerciseId,
    order: count,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    restSeconds: 90,
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

  const sets: WorkoutSet[] = [];
  for (const pe of planned) {
    const last = await lastPerformance(pe.exerciseId);
    const lastWeight = last?.sets.filter((s) => s.completed && s.weightKg != null).at(-1)?.weightKg;
    const deload = program?.deloadActive ?? false;
    const baseWeight = pe.targetWeightKg ?? lastWeight;
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
  const last = await lastPerformance(exerciseId, sessionId);
  await db.workoutSets.add({
    id: newId(),
    sessionId,
    exerciseId,
    exerciseOrder: maxOrder + 1,
    setNumber: 1,
    weightKg: last?.sets.at(-1)?.weightKg,
    restSeconds: 90,
    completed: false,
    skipped: false,
    createdAt: nowIso(),
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
      return { session, sets: ss, topSet, volume: ss.reduce((v, s) => v + setVolume(s), 0), best1rm };
    });
  const pbWeight = Math.max(0, ...rows.map((r) => r.topSet?.weightKg ?? 0));
  const pb1rm = Math.max(0, ...rows.map((r) => r.best1rm));
  return { rows, pbWeight, pb1rm };
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
): ProgressionHint | undefined {
  if (!last) return undefined;
  if (last.session.hadPain) {
    return { kind: "caution", message: "Sesi terakhir tercatat nyeri. Pertahankan atau turunkan beban; konsultasikan bila berlanjut." };
  }
  if (last.session.isDeload) return { kind: "hold", message: "Sesi terakhir deload — kembali ke beban normal sebelumnya." };
  const done = last.sets.filter((s) => s.completed);
  if (!done.length || !target.repMax) return undefined;
  const allTop = done.length >= (target.targetSets ?? 1) && done.every((s) => (s.reps ?? 0) >= target.repMax!);
  const highRpe = done.some((s) => (s.rpe ?? 0) >= 9.5);
  if (allTop && !highRpe) {
    return { kind: "increase", message: "Semua set mencapai batas atas repetisi. Pertimbangkan +2,5 kg (atau +1 repetisi) jika teknik tetap baik." };
  }
  return { kind: "hold", message: "Pertahankan beban, kejar repetisi sampai batas atas di semua set." };
}
