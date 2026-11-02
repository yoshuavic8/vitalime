import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, Dumbbell, Pencil, Play, Plus, TriangleAlert } from "lucide-react";
import { ExerciseThumb } from "../components/ExerciseAnimation";
import { Badge, Button, Card, Chip, EmptyState, IconButton, Notice, Page, PageHeader, SectionTitle, Sheet, Toggle, cx, useToast } from "../components/ui";
import { ExercisePicker } from "../components/ExercisePicker";
import { useLiveQuery } from "../hooks";
import {
  createBlankProgram,
  createProgramFromTemplate,
  exerciseMap,
  getInProgressSession,
  getProgramDetail,
  listPrograms,
  listSessions,
  listSetsForSessions,
  setActiveProgram,
  setVolume,
  startSession,
  updateProgram,
} from "../db/repo/training";
import {
  daysPerWeek,
  GOAL_LABEL,
  LEVEL_LABEL,
  PLACE_LABEL,
  PROGRAM_TEMPLATES,
  type ProgramGoal,
  type ProgramLevel,
  type ProgramPlace,
  type ProgramTemplate,
} from "../data/programTemplates";
import { getTrainingSetup } from "../db/repo/settings";
import type { Equipment, Exercise } from "../db/types";
import { formatTime, relativeDayLabel, WEEKDAY_SHORT } from "../lib/date";
import { fmtInt } from "../lib/format";
import { EQUIPMENT_LABEL } from "../lib/labels";

function missingEquipment(t: ProgramTemplate, exercises: Record<string, Exercise>, mine: Equipment[]): Equipment[] {
  const needed = new Set(t.days.flatMap((d) => d.exercises.map((e) => exercises[e.exerciseId]?.equipment)).filter((e): e is Equipment => !!e));
  return [...needed].filter((e) => !mine.includes(e));
}

export default function TrainingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const weekday = new Date().getDay();

  const data = useLiveQuery(async () => {
    const [programs, inProgress, sessions, exercises] = await Promise.all([
      listPrograms(),
      getInProgressSession(),
      listSessions(15),
      exerciseMap(),
    ]);
    const active = programs.find((p) => p.status === "active");
    const detail = active ? await getProgramDetail(active.id) : undefined;
    const completed = sessions.filter((s) => s.status === "completed");
    const sets = await listSetsForSessions(completed.map((s) => s.id));
    const stats = Object.fromEntries(
      completed.map((s) => {
        const ss = sets.filter((x) => x.sessionId === s.id);
        return [s.id, { sets: ss.filter((x) => x.completed).length, volume: ss.reduce((v, x) => v + setVolume(x), 0) }];
      }),
    );
    const setup = await getTrainingSetup();
    return { programs, inProgress, completed, stats, detail, exercises, setup };
  });

  const [goal, setGoal] = useState<"all" | ProgramGoal>("all");
  const [placeChoice, setPlace] = useState<"all" | ProgramPlace>();
  const [level, setLevel] = useState<"all" | ProgramLevel>("all");
  const savedPlace = data?.setup.place;
  const place = placeChoice ?? (savedPlace && savedPlace !== "both" ? savedPlace : "all");
  const templates = PROGRAM_TEMPLATES.filter(
    (t) => (goal === "all" || t.goal === goal) && (place === "all" || t.place === place) && (level === "all" || t.level === level),
  );

  const begin = async (dayId?: string) => {
    if (data?.inProgress) return navigate(`/training/session/${data.inProgress.id}`);
    const id = await startSession(dayId);
    navigate(`/training/session/${id}`);
  };

  const detail = data?.detail;

  return (
    <Page>
      <PageHeader
        title="Training"
        right={
          <IconButton label="Library latihan" onClick={() => setLibraryOpen(true)}>
            <BookOpen className="size-5" />
          </IconButton>
        }
      />

      {data?.inProgress && (
        <Card glow className="mb-3" onClick={() => navigate(`/training/session/${data.inProgress!.id}`)}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-lime-400 text-ink-950">
              <Play className="size-5" fill="currentColor" />
            </span>
            <div className="flex-1">
              <div className="font-semibold">Lanjutkan: {data.inProgress.name}</div>
              <div className="text-sm text-ink-400">Dimulai {formatTime(data.inProgress.startedAt)}</div>
            </div>
            <ChevronRight className="size-5 text-ink-400" />
          </div>
        </Card>
      )}

      {detail ? (
        <Card className="bg-lime-radial">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge tone="lime">Aktif</Badge>
                {detail.program.deloadActive && <Badge tone="warn">Deload</Badge>}
              </div>
              <div className="mt-1.5 font-display text-xl font-bold">{detail.program.name}</div>
              <div className="text-sm text-ink-400">{detail.days.length} hari latihan / minggu</div>
            </div>
            <IconButton label="Edit program" onClick={() => navigate(`/training/program/${detail.program.id}`)}>
              <Pencil className="size-4" />
            </IconButton>
          </div>

          <div className="mt-4 space-y-2">
            {detail.days.map(({ day, exercises }) => {
              const isToday = day.weekdays.includes(weekday);
              return (
                <div
                  key={day.id}
                  className={cx(
                    "flex items-center gap-3 rounded-2xl border p-3",
                    isToday ? "border-lime-400/40 bg-lime-400/[0.07]" : "border-white/[0.06] bg-black/20",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      {day.name}
                      {isToday && <Badge tone="lime">Hari ini</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {day.weekdays.length ? day.weekdays.map((w) => WEEKDAY_SHORT[w]).join(", ") : "Tidak terjadwal"} · {exercises.length} latihan
                    </div>
                  </div>
                  <Button size="sm" variant={isToday ? "primary" : "secondary"} icon={<Play className="size-3.5" />} onClick={() => begin(day.id)}>
                    Mulai
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-2">
            <Toggle
              checked={detail.program.deloadActive}
              onChange={(v) => updateProgram(detail.program.id, { deloadActive: v })}
              label="Minggu deload"
              hint="Sesi baru memakai ±60% beban dan separuh set."
            />
          </div>
        </Card>
      ) : (
        data && (
          <EmptyState
            icon={<Dumbbell className="size-6" />}
            title="Belum ada program"
            text="Mulai dari template yang bisa kamu sesuaikan, atau buat program sendiri."
            action={<Button onClick={() => setTemplatesOpen(true)}>Pilih template</Button>}
          />
        )
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<Play className="size-4" />} onClick={() => begin()}>
          Sesi bebas
        </Button>
        <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setTemplatesOpen(true)}>
          Program baru
        </Button>
      </div>

      <div className="mt-3">
        <Notice tone="warn">
          <div className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>Hentikan latihan bila muncul nyeri tajam, pusing, atau gejala tidak biasa. Aplikasi ini bukan pengganti penilaian profesional.</span>
          </div>
        </Notice>
      </div>

      {data && data.programs.filter((p) => p.status !== "active").length > 0 && (
        <>
          <SectionTitle>Program lain</SectionTitle>
          <div className="space-y-2">
            {data.programs
              .filter((p) => p.status !== "active")
              .map((p) => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/training/program/${p.id}`)}>
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="text-xs text-ink-400">{p.daysPerWeek} hari / minggu</div>
                    </button>
                    <Button size="sm" variant="secondary" onClick={() => setActiveProgram(p.id)}>
                      Aktifkan
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        </>
      )}

      <SectionTitle>Riwayat sesi</SectionTitle>
      {!data?.completed.length && <p className="px-1 text-sm text-ink-400">Belum ada sesi selesai.</p>}
      <div className="space-y-2">
        {data?.completed.map((s) => (
          <Card key={s.id} className="p-3" onClick={() => navigate(`/training/session/${s.id}`)}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{s.name}</span>
                  {s.isDeload && <Badge tone="warn">Deload</Badge>}
                  {s.hadPain && <Badge tone="warn">Nyeri</Badge>}
                </div>
                <div className="text-xs text-ink-400">
                  {relativeDayLabel(s.localDate)} · {data.stats[s.id]?.sets ?? 0} set
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold tabular-nums">{fmtInt(data.stats[s.id]?.volume)}</div>
                <div className="text-[10px] text-ink-400">kg volume</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Program baru">
        <p className="mb-3 text-sm text-ink-400">Template hanya titik awal — sesuaikan latihan, set, dan jadwal dengan pengalaman, alat, dan kondisi kamu.</p>
        <div className="space-y-2">
          <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
            <Chip active={goal === "all"} onClick={() => setGoal("all")}>
              Semua tujuan
            </Chip>
            {(Object.entries(GOAL_LABEL) as [ProgramGoal, string][]).map(([k, v]) => (
              <Chip key={k} active={goal === k} onClick={() => setGoal(k)}>
                {v}
              </Chip>
            ))}
          </div>
          <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
            <Chip active={place === "all"} onClick={() => setPlace("all")}>
              Gym & rumah
            </Chip>
            {(Object.entries(PLACE_LABEL) as [ProgramPlace, string][]).map(([k, v]) => (
              <Chip key={k} active={place === k} onClick={() => setPlace(k)}>
                {v}
              </Chip>
            ))}
            <span className="w-2 shrink-0" />
            <Chip active={level === "all"} onClick={() => setLevel("all")}>
              Semua level
            </Chip>
            {(Object.entries(LEVEL_LABEL) as [ProgramLevel, string][]).map(([k, v]) => (
              <Chip key={k} active={level === k} onClick={() => setLevel(k)}>
                {v}
              </Chip>
            ))}
          </div>
          {templates.map((t) => {
            const missing = data ? missingEquipment(t, data.exercises, data.setup.equipment) : [];
            return (
              <Card
                key={t.key}
                onClick={async () => {
                  const id = await createProgramFromTemplate(t.key);
                  setTemplatesOpen(false);
                  toast("Program dibuat & diaktifkan");
                  navigate(`/training/program/${id}`);
                }}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 font-semibold">{t.name}</span>
                  <Badge tone="lime">{GOAL_LABEL[t.goal]}</Badge>
                  <Badge tone="info">{PLACE_LABEL[t.place]}</Badge>
                  <Badge>{LEVEL_LABEL[t.level]}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-400">{t.description}</p>
                <div className="mt-2 flex items-center gap-1">
                  {[...new Set(t.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))].slice(0, 6).map((id) => (
                    <ExerciseThumb key={id} exerciseId={id} size={36} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {daysPerWeek(t)}×/minggu · ±{t.minutes} menit · {t.days.map((d) => d.name).join(", ")}
                </p>
                {missing.length > 0 && (
                  <p className="mt-1 text-xs text-amber-300">Butuh alat yang belum kamu tandai: {missing.map((e) => EQUIPMENT_LABEL[e]).join(", ")}</p>
                )}
              </Card>
            );
          })}
          {!templates.length && <p className="py-4 text-center text-sm text-ink-400">Tidak ada template untuk filter ini.</p>}
          <Card
            onClick={async () => {
              const id = await createBlankProgram("Program custom");
              setTemplatesOpen(false);
              navigate(`/training/program/${id}`);
            }}
          >
            <div className="font-semibold">Program kosong</div>
            <p className="mt-1 text-sm text-ink-400">Susun sendiri dari library latihan.</p>
          </Card>
        </div>
      </Sheet>

      <ExercisePicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(id) => {
          setLibraryOpen(false);
          navigate(`/training/exercise/${id}`);
        }}
      />
    </Page>
  );
}
