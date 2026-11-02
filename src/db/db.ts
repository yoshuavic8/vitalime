import Dexie, { type EntityTable } from "dexie";
import type {
  ActivityEntry,
  AiAnalysis,
  AppSetting,
  BodyMeasurement,
  DailyNote,
  Exercise,
  FoodEntry,
  FoodPhoto,
  FoodTemplate,
  Goal,
  HealthImport,
  HealthMetric,
  Profile,
  ProgramDay,
  ProgramExercise,
  SchemaMeta,
  TrainingProgram,
  WorkoutSession,
  WorkoutSet,
} from "./types";

export const DB_NAME = "personal-health-os";
export const SCHEMA_VERSION = 1;

export class HealthDB extends Dexie {
  profile!: EntityTable<Profile, "id">;
  goals!: EntityTable<Goal, "id">;
  foodEntries!: EntityTable<FoodEntry, "id">;
  foodPhotos!: EntityTable<FoodPhoto, "id">;
  foodTemplates!: EntityTable<FoodTemplate, "id">;
  activityEntries!: EntityTable<ActivityEntry, "id">;
  healthMetrics!: EntityTable<HealthMetric, "id">;
  healthImports!: EntityTable<HealthImport, "id">;
  bodyMeasurements!: EntityTable<BodyMeasurement, "id">;
  exerciseLibrary!: EntityTable<Exercise, "id">;
  trainingPrograms!: EntityTable<TrainingProgram, "id">;
  programDays!: EntityTable<ProgramDay, "id">;
  programExercises!: EntityTable<ProgramExercise, "id">;
  workoutSessions!: EntityTable<WorkoutSession, "id">;
  workoutSets!: EntityTable<WorkoutSet, "id">;
  aiAnalyses!: EntityTable<AiAnalysis, "id">;
  dailyNotes!: EntityTable<DailyNote, "id">;
  appSettings!: EntityTable<AppSetting, "key">;
  schemaMeta!: EntityTable<SchemaMeta, "key">;

  constructor() {
    super(DB_NAME);
    // Never edit a released version in place: add `this.version(n + 1).stores(...).upgrade(...)`
    // so existing user data is migrated, not dropped.
    this.version(1).stores({
      profile: "id",
      goals: "id, effectiveFrom",
      foodEntries: "id, localDate, mealType, name, consumedAt",
      foodPhotos: "id, foodEntryId, createdAt",
      foodTemplates: "id, name, useCount",
      activityEntries: "id, localDate, startedAt, &fingerprint, source, importId",
      healthMetrics: "id, [metric+localDate], localDate, &fingerprint, importId",
      healthImports: "id, importedAt",
      bodyMeasurements: "id, localDate, measuredAt, fingerprint",
      exerciseLibrary: "id, name, primaryMuscle",
      trainingPrograms: "id, status",
      programDays: "id, programId, order",
      programExercises: "id, programDayId, exerciseId",
      workoutSessions: "id, localDate, startedAt, programDayId, status",
      workoutSets: "id, sessionId, exerciseId, [sessionId+exerciseId]",
      aiAnalyses: "id, foodEntryId, createdAt",
      dailyNotes: "id, &localDate",
      appSettings: "key",
      schemaMeta: "key",
    });
  }
}

export const db = new HealthDB();

export const ALL_TABLES = [
  "profile",
  "goals",
  "foodEntries",
  "foodPhotos",
  "foodTemplates",
  "activityEntries",
  "healthMetrics",
  "healthImports",
  "bodyMeasurements",
  "exerciseLibrary",
  "trainingPrograms",
  "programDays",
  "programExercises",
  "workoutSessions",
  "workoutSets",
  "aiAnalyses",
  "dailyNotes",
  "appSettings",
  "schemaMeta",
] as const;

export type TableName = (typeof ALL_TABLES)[number];
