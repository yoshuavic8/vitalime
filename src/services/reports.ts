import { getGoalOrDefault } from "../db/repo/settings";
import { listFoodBetween, listFoodByDate } from "../db/repo/food";
import { healthTotalsBetween, healthTotalsFor, lastImport, listActivitiesBetween, listActivitiesByDate } from "../db/repo/activity";
import { latestWeight, listMeasurements, weightSeries } from "../db/repo/body";
import { exerciseMap, listSessionsBetween, listSetsForSessions, setVolume } from "../db/repo/training";
import type { ActivityEntry, FoodEntry, Goal } from "../db/types";
import { addDays, dateRange, formatDayShort } from "../lib/date";
import { fmt1, fmtInt, sum } from "../lib/format";

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export function totals(entries: FoodEntry[]): Macros {
  return {
    kcal: sum(entries.map((e) => e.caloriesKcal)),
    protein: sum(entries.map((e) => e.proteinG)),
    carbs: sum(entries.map((e) => e.carbsG)),
    fat: sum(entries.map((e) => e.fatG)),
  };
}

export type EnergyOut = {
  /** Active energy for the day; Health's daily total wins so workout energy isn't counted twice. */
  activeKcal?: number;
  activeSource?: "health" | "activities";
  restingKcal?: number;
};

export function resolveEnergy(health: Partial<Record<string, number>>, activities: ActivityEntry[]): EnergyOut {
  const fromActivities = sum(activities.map((a) => a.activeEnergyKcal));
  const out: EnergyOut = { restingKcal: health.resting_energy };
  if (health.active_energy != null) {
    out.activeKcal = health.active_energy;
    out.activeSource = "health";
  } else if (fromActivities > 0) {
    out.activeKcal = fromActivities;
    out.activeSource = "activities";
  }
  return out;
}

export function effectiveTarget(goal: Goal | undefined, energy: EnergyOut) {
  if (!goal) return undefined;
  if (goal.targetMode === "activity_adjusted" && energy.activeKcal) return goal.caloriesKcal + energy.activeKcal;
  return goal.caloriesKcal;
}

export async function getDaySummary(localDate: string) {
  const [food, { goal, isDefault: goalIsDefault }, health, activities, weight, sessions, lastHealthImport] = await Promise.all([
    listFoodByDate(localDate),
    getGoalOrDefault(localDate),
    healthTotalsFor(localDate),
    listActivitiesByDate(localDate),
    latestWeight(),
    listSessionsBetween(localDate, localDate),
    lastImport(),
  ]);
  const energy = resolveEnergy(health, activities);
  const drafts = food.filter((f) => f.verification === "draft").length;
  return {
    food,
    intake: totals(food),
    goal,
    goalIsDefault,
    target: effectiveTarget(goal, energy),
    energy,
    health,
    activities,
    weight,
    sessions,
    lastHealthImport,
    drafts,
  };
}

export type DaySummary = Awaited<ReturnType<typeof getDaySummary>>;

export async function getWeeklyReport(weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const days = dateRange(weekStart, weekEnd);
  const [food, activities, health, sessions, measurements, exercises, goal] = await Promise.all([
    listFoodBetween(weekStart, weekEnd),
    listActivitiesBetween(weekStart, weekEnd),
    healthTotalsBetween(weekStart, weekEnd),
    listSessionsBetween(weekStart, weekEnd),
    listMeasurements(),
    exerciseMap(),
    getGoalOrDefault(weekEnd).then((g) => g.goal),
  ]);

  const perDay = days.map((d) => {
    const entries = food.filter((f) => f.localDate === d);
    const dayActs = activities.filter((a) => a.localDate === d);
    return {
      localDate: d,
      logged: entries.length > 0,
      entries: entries.length,
      ...totals(entries),
      energy: resolveEnergy(health[d] ?? {}, dayActs),
      steps: health[d]?.steps,
      activities: dayActs.length,
    };
  });

  const loggedDays = perDay.filter((d) => d.logged);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined);

  const freq = new Map<string, number>();
  for (const f of food) freq.set(f.name.trim(), (freq.get(f.name.trim()) ?? 0) + 1);
  const topFoods = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const sets = await listSetsForSessions(completedSessions.map((s) => s.id));
  const volume = sets.reduce((v, s) => v + setVolume(s), 0);
  const painSessions = completedSessions.filter((s) => s.hadPain).length;

  const series = weightSeries(measurements);
  const inWeek = series.filter((p) => p.localDate >= weekStart && p.localDate <= weekEnd);
  const weightStart = inWeek[0];
  const weightEnd = inWeek.at(-1);
  const waist = measurements.filter((m) => m.waistCm != null && m.localDate >= weekStart && m.localDate <= weekEnd);

  const exerciseNames = [...new Set(sets.filter((s) => s.completed).map((s) => exercises[s.exerciseId]?.name))].filter(Boolean);

  return {
    weekStart,
    weekEnd,
    perDay,
    goal,
    loggedDays: loggedDays.length,
    avgKcal: avg(loggedDays.map((d) => d.kcal)),
    avgProtein: avg(loggedDays.map((d) => d.protein)),
    avgCarbs: avg(loggedDays.map((d) => d.carbs)),
    avgFat: avg(loggedDays.map((d) => d.fat)),
    avgSteps: avg(perDay.filter((d) => d.steps != null).map((d) => d.steps!)),
    activityCount: activities.length,
    activityMinutes: sum(activities.map((a) => a.durationMinutes)),
    sessionsCompleted: completedSessions.length,
    setsCompleted: sets.filter((s) => s.completed).length,
    volume,
    painSessions,
    exerciseNames: exerciseNames as string[],
    topFoods,
    weightStart,
    weightEnd,
    waistStart: waist[0]?.waistCm,
    waistEnd: waist.at(-1)?.waistCm,
    draftEntries: food.filter((f) => f.verification === "draft").length,
  };
}

export type WeeklyReport = Awaited<ReturnType<typeof getWeeklyReport>>;

/** Text-only summary (no photos) for the report export and the optional AI weekly review. */
export function weeklyReportMarkdown(r: WeeklyReport): string {
  const L: string[] = [];
  L.push(`# Laporan Mingguan Vitalime`, `Periode: ${formatDayShort(r.weekStart)} – ${formatDayShort(r.weekEnd)}`, "");
  L.push(`## Nutrisi`);
  L.push(`- Hari tercatat: ${r.loggedDays}/7`);
  if (r.goal) L.push(`- Target: ${fmtInt(r.goal.caloriesKcal)} kkal, protein ${fmtInt(r.goal.proteinG)} g`);
  L.push(`- Rata-rata (hari tercatat): ${fmtInt(r.avgKcal)} kkal · P ${fmtInt(r.avgProtein)} g · K ${fmtInt(r.avgCarbs)} g · L ${fmtInt(r.avgFat)} g`);
  if (r.draftEntries) L.push(`- ${r.draftEntries} entri masih draft (estimasi belum dikonfirmasi)`);
  if (r.topFoods.length) L.push(`- Paling sering: ${r.topFoods.map(([n, c]) => `${n} (${c}×)`).join(", ")}`);
  L.push("", "| Tanggal | Entri | Kkal | Protein | Aktif (kkal) | Langkah |", "|---|---|---|---|---|---|");
  for (const d of r.perDay) {
    L.push(
      `| ${formatDayShort(d.localDate)} | ${d.logged ? d.entries : "belum tercatat"} | ${d.logged ? fmtInt(d.kcal) : "—"} | ${d.logged ? fmtInt(d.protein) : "—"} | ${fmtInt(d.energy.activeKcal)} | ${fmtInt(d.steps)} |`,
    );
  }
  L.push("", `## Aktivitas`);
  L.push(`- ${r.activityCount} aktivitas, total ${fmtInt(r.activityMinutes)} menit`);
  L.push(`- Rata-rata langkah: ${r.avgSteps != null ? fmtInt(r.avgSteps) : "belum tercatat"}`);
  L.push("", `## Latihan beban`);
  L.push(`- ${r.sessionsCompleted} sesi selesai, ${r.setsCompleted} set, volume ${fmtInt(r.volume)} kg`);
  if (r.exerciseNames.length) L.push(`- Latihan: ${r.exerciseNames.join(", ")}`);
  if (r.painSessions) L.push(`- ${r.painSessions} sesi dengan catatan nyeri/ketidaknyamanan`);
  L.push("", `## Tubuh`);
  if (r.weightStart && r.weightEnd) {
    L.push(`- Berat: ${fmt1(r.weightStart.weightKg)} → ${fmt1(r.weightEnd.weightKg)} kg`);
    if (r.weightStart.avg7 != null && r.weightEnd.avg7 != null) {
      L.push(`- Rata-rata 7 hari: ${fmt1(r.weightStart.avg7)} → ${fmt1(r.weightEnd.avg7)} kg`);
    }
  } else L.push(`- Berat: belum cukup data`);
  if (r.waistStart != null) L.push(`- Pinggang: ${fmt1(r.waistStart)} → ${fmt1(r.waistEnd)} cm`);
  return L.join("\n");
}

export function weeklyReviewPrompt(r: WeeklyReport): string {
  return [
    "Berikut ringkasan data kesehatan pribadi saya minggu ini (hanya teks, tanpa foto).",
    "Tolong rangkum pola makan, konsistensi pencatatan, asupan protein/kalori, konsistensi olahraga, dan progres latihan beban.",
    "Aturan: jangan mendiagnosis penyakit, jangan menyarankan obat/terapi, jangan mengarang data yang tidak ada,",
    "anggap kalori dari foto sebagai estimasi, dan sebutkan bila data tidak lengkap.",
    "Akhiri dengan 3 pertanyaan yang bisa saya bawa ke ahli gizi/pelatih.",
    "",
    weeklyReportMarkdown(r),
  ].join("\n");
}
