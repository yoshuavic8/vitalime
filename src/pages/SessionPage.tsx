import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronRight, Info, Minus, Play, Plus, Repeat, SkipForward, Square, Timer, Trash2, TriangleAlert, TrendingUp } from "lucide-react";
import { Badge, Button, Card, Field, Notice, Page, PageHeader, Sheet, TextArea, Toggle, cx, useToast } from "../components/ui";
import { ExercisePicker } from "../components/ExercisePicker";
import { ExerciseAnimation, ExerciseThumb } from "../components/ExerciseAnimation";
import { useLiveQuery, useNow } from "../hooks";
import {
  addExerciseToSession,
  addSet,
  deleteSession,
  deleteSet,
  exerciseMap,
  finishSession,
  getSessionDetail,
  lastPerformance,
  programTargetsFor,
  progressionHint,
  setVolume,
  swapCandidates,
  swapSessionExercise,
  updateSession,
  updateSet,
} from "../db/repo/training";
import { getTrainingSetup } from "../db/repo/settings";
import type { Exercise, ExerciseMetric, WorkoutSet } from "../db/types";
import { formatDayLong } from "../lib/date";
import { fmtInt } from "../lib/format";
import { EQUIPMENT_LABEL } from "../lib/labels";
import { clock, formatSet, metricOf, targetLabel } from "../lib/sets";

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio is best-effort only.
  }
}

type Hold = { setId: string; startedAt: number; total: number; restSeconds?: number };

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [techniqueFor, setTechniqueFor] = useState<string>();
  const [swapFor, setSwapFor] = useState<string>();
  const [restEndsAt, setRestEndsAt] = useState<number>();
  const [hold, setHold] = useState<Hold>();
  const beeped = useRef(false);

  const data = useLiveQuery(async () => {
    const detail = await getSessionDetail(id!);
    if (!detail) return { detail };
    const [exercises, targets, setup] = await Promise.all([exerciseMap(), programTargetsFor(detail.session.programDayId), getTrainingSetup()]);
    const lasts = Object.fromEntries(
      await Promise.all(detail.groups.map(async (g) => [g.exerciseId, await lastPerformance(g.exerciseId, detail.session.id)] as const)),
    );
    return { detail, exercises, targets, lasts, setup };
  }, [id]);

  const live = data?.detail?.session.status === "in_progress";
  const now = useNow(hold ? 250 : 1000, live);
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const holdElapsed = hold ? Math.min(hold.total, Math.floor((now - hold.startedAt) / 1000)) : 0;

  useEffect(() => {
    if (restEndsAt && restLeft === 0 && !beeped.current) {
      beeped.current = true;
      beep();
      toast("Waktu istirahat selesai");
      setRestEndsAt(undefined);
    }
  }, [restLeft, restEndsAt, toast]);

  const finishHold = async (h: Hold, seconds: number) => {
    setHold(undefined);
    if (seconds <= 0) return;
    await updateSet(h.setId, { durationSec: seconds, completed: true, skipped: false });
    if (h.restSeconds) {
      beeped.current = false;
      setRestEndsAt(Date.now() + h.restSeconds * 1000);
    }
  };

  useEffect(() => {
    if (hold && holdElapsed >= hold.total) {
      beep();
      toast("Waktu tercapai");
      void finishHold(hold, hold.total);
    }
    // finishHold only closes over stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold, holdElapsed, toast]);

  if (!data) return null;
  if (!data.detail) return <Page><PageHeader back title="Sesi tidak ditemukan" /></Page>;
  const { session, groups } = data.detail;
  const { exercises, targets, lasts, setup } = data;

  const elapsed = Math.floor(((session.endedAt ? new Date(session.endedAt).getTime() : now) - new Date(session.startedAt).getTime()) / 1000);
  const allSets = groups.flatMap((g) => g.sets);
  const volume = allSets.reduce((v, s) => v + setVolume(s), 0);
  const doneCount = allSets.filter((s) => s.completed).length;

  const startRest = (s: WorkoutSet) => {
    if (!s.restSeconds || !live) return;
    beeped.current = false;
    setRestEndsAt(Date.now() + s.restSeconds * 1000);
  };

  const completeSet = async (s: WorkoutSet) => {
    const completed = !s.completed;
    await updateSet(s.id, { completed, skipped: false });
    const next = groups.find((g) => g.exerciseId === s.exerciseId)?.sets.find((x) => x.setNumber > s.setNumber && !x.completed);
    if (completed && next && next.weightKg == null && s.weightKg != null) await updateSet(next.id, { weightKg: s.weightKg });
    if (completed) startRest(s);
  };

  return (
    <Page className="pb-40">
      <PageHeader
        back="/training"
        title={session.name}
        subtitle={live ? `Berlangsung · ${clock(elapsed)}` : formatDayLong(session.localDate)}
        right={
          <button
            aria-label="Hapus sesi"
            className="grid size-10 place-items-center rounded-full text-red-300 active:bg-white/5"
            onClick={async () => {
              if (!confirm("Hapus sesi ini beserta semua set?")) return;
              await deleteSession(session.id);
              navigate("/training", { replace: true });
            }}
          >
            <Trash2 className="size-5" />
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <Summary label="Durasi" value={clock(elapsed)} />
        <Summary label="Set selesai" value={`${doneCount}/${allSets.length}`} />
        <Summary label="Volume" value={`${fmtInt(volume)} kg`} />
      </div>

      {session.isDeload && (
        <div className="mt-3">
          <Notice tone="warn">Minggu deload: beban ±60% dan set dikurangi. Fokus pada teknik dan pemulihan.</Notice>
        </div>
      )}

      {groups.map((g) => {
        const ex = exercises[g.exerciseId];
        const metric = metricOf(ex);
        const last = lasts[g.exerciseId];
        const lastDone = last?.sets.filter((s) => s.completed) ?? [];
        const target = targets[g.exerciseId];
        const hint = progressionHint(last, { repMax: target?.repMax ?? g.sets[0]?.targetRepMax, targetSets: target?.targetSets }, metric);
        const tLabel = targetLabel(g.sets[0]?.targetRepMin, g.sets[0]?.targetRepMax, metric);
        const canSwap = live && g.sets.some((s) => !s.completed);
        return (
          <section key={g.exerciseId} className="mt-5">
            <Card className="p-0">
              <div className="flex items-center gap-3 px-4 pb-2 pt-4">
                <button aria-label="Lihat teknik" onClick={() => setTechniqueFor(g.exerciseId)}>
                  <ExerciseThumb exerciseId={g.exerciseId} size={56} />
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/training/exercise/${g.exerciseId}`)}>
                  <div className="flex items-center gap-1.5 font-display text-lg font-bold leading-tight">
                    <span className="truncate">{ex?.name ?? "Latihan"}</span>
                    {ex?.needsCaution && <TriangleAlert className="size-4 shrink-0 text-amber-400" />}
                    <ChevronRight className="size-4 shrink-0 text-ink-500" />
                  </div>
                  <div className="text-xs text-ink-400">
                    {tLabel ? `Target ${tLabel}` : ex?.primaryMuscle}
                    {lastDone.length > 0 && ` · terakhir: ${lastDone.map((s) => formatSet(s, metric)).join(", ")}`}
                  </div>
                </button>
                {canSwap && (
                  <button aria-label="Ganti latihan" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.05] text-ink-300" onClick={() => setSwapFor(g.exerciseId)}>
                    <Repeat className="size-4" />
                  </button>
                )}
              </div>

              {hint && live && (
                <div
                  className={cx(
                    "mx-4 mb-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
                    hint.kind === "increase" && "bg-lime-400/10 text-lime-200",
                    hint.kind === "hold" && "bg-white/[0.04] text-ink-300",
                    hint.kind === "caution" && "bg-amber-400/10 text-amber-200",
                  )}
                >
                  {hint.kind === "increase" ? <TrendingUp className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0" />}
                  {hint.message}
                </div>
              )}

              <SetHeader metric={metric} />
              <div className="space-y-1.5 px-3 pb-3">
                {g.sets.map((s) => (
                  <SetRow
                    key={s.id}
                    set={s}
                    metric={metric}
                    live={live}
                    holding={hold?.setId === s.id}
                    onToggle={() => completeSet(s)}
                    onStartHold={() => {
                      setRestEndsAt(undefined);
                      setHold({ setId: s.id, startedAt: Date.now(), total: s.durationSec ?? s.targetRepMax ?? 30, restSeconds: live ? s.restSeconds : undefined });
                    }}
                  />
                ))}
              </div>
              <div className="flex border-t border-white/[0.05]">
                <button className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium text-lime-400 active:bg-white/5" onClick={() => addSet(session.id, g.exerciseId)}>
                  <Plus className="size-4" /> Set
                </button>
                {g.sets.length > 0 && (
                  <button
                    className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium text-ink-400 active:bg-white/5"
                    onClick={() => deleteSet(g.sets[g.sets.length - 1].id)}
                  >
                    <Minus className="size-4" /> Set
                  </button>
                )}
              </div>
            </Card>
          </section>
        );
      })}

      <Button variant="secondary" block className="mt-4" icon={<Plus className="size-4" />} onClick={() => setPickerOpen(true)}>
        Tambah latihan
      </Button>

      {!live && (
        <Card className="mt-4">
          <div className="text-sm text-ink-300">
            Energi: {session.energyLevel ? `${session.energyLevel}/5` : "—"}
            {session.hadPain && <Badge tone="warn">Nyeri</Badge>}
          </div>
          {session.painNotes && <p className="mt-1 text-sm text-amber-200/90">{session.painNotes}</p>}
          {session.notes && <p className="mt-1 text-sm text-ink-400">{session.notes}</p>}
        </Card>
      )}

      {/* Bottom bar: hold timer / rest timer + finish */}
      {live && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-ink-900/90 px-4 pt-3 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            {hold ? (
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-lime-400 px-3 py-2 text-ink-950">
                <Play className="size-5" fill="currentColor" />
                <span className="font-display text-xl font-bold tabular-nums">{clock(hold.total - holdElapsed)}</span>
                <span className="truncate text-xs font-medium">{exercises[allSets.find((s) => s.id === hold.setId)?.exerciseId ?? ""]?.name}</span>
                <button aria-label="Stop dan simpan" className="ml-auto rounded-lg bg-black/15 p-1.5" onClick={() => finishHold(hold, holdElapsed)}>
                  <Square className="size-4" fill="currentColor" />
                </button>
              </div>
            ) : restEndsAt ? (
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-lime-400/10 px-3 py-2">
                <Timer className="size-5 text-lime-400" />
                <span className="font-display text-xl font-bold tabular-nums text-lime-300">{clock(restLeft)}</span>
                <button className="ml-auto rounded-lg bg-white/[0.06] px-2 py-1 text-xs" onClick={() => setRestEndsAt((t) => (t ?? Date.now()) + 15000)}>
                  +15d
                </button>
                <button aria-label="Lewati istirahat" className="rounded-lg bg-white/[0.06] p-1.5" onClick={() => setRestEndsAt(undefined)}>
                  <SkipForward className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex-1 text-xs text-ink-400">Centang set untuk memulai timer istirahat.</div>
            )}
            <Button onClick={() => setFinishOpen(true)}>Selesai</Button>
          </div>
        </div>
      )}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (exerciseId) => {
          await addExerciseToSession(session.id, exerciseId);
          setPickerOpen(false);
        }}
      />

      <TechniqueSheet exercise={techniqueFor ? exercises[techniqueFor] : undefined} exerciseId={techniqueFor} onClose={() => setTechniqueFor(undefined)} />

      <SwapSheet
        from={swapFor ? exercises[swapFor] : undefined}
        candidates={swapFor && exercises[swapFor] ? swapCandidates(exercises[swapFor], Object.values(exercises), setup.equipment) : []}
        onClose={() => setSwapFor(undefined)}
        onPick={async (toId) => {
          await swapSessionExercise(session.id, swapFor!, toId);
          setSwapFor(undefined);
          toast("Latihan diganti");
        }}
      />

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        incomplete={allSets.length - doneCount}
        onFinish={async (patch) => {
          // Untouched sets are recorded as skipped rather than silently counted.
          await Promise.all(allSets.filter((s) => !s.completed).map((s) => updateSet(s.id, { skipped: true })));
          await finishSession(session.id, patch);
          toast("Sesi tersimpan");
          navigate("/training", { replace: true });
        }}
        onDraftChange={(patch) => updateSession(session.id, patch)}
      />
    </Page>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="font-display text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-ink-400">{label}</div>
    </Card>
  );
}

const GRID: Record<ExerciseMetric, string> = {
  reps: "grid-cols-[28px_1fr_1fr_56px_44px]",
  time: "grid-cols-[28px_1fr_56px_44px_44px]",
  cardio: "grid-cols-[28px_1fr_1fr_56px_44px]",
};

function SetHeader({ metric }: { metric: ExerciseMetric }) {
  const cols = metric === "reps" ? ["kg", "Rep", "RPE", ""] : metric === "time" ? ["Detik", "RPE", "", ""] : ["Menit", "km", "RPE", ""];
  return (
    <div className={cx("grid items-center gap-1.5 px-3 pb-1 text-[10px] uppercase tracking-wide text-ink-500", GRID[metric])}>
      <span className="text-center">Set</span>
      {cols.map((c, i) => (
        <span key={i} className="text-center">
          {c}
        </span>
      ))}
    </div>
  );
}

const parseCell = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v === "" || !Number.isFinite(n) ? undefined : n;
};

/** Saves on every keystroke; adopts external changes (e.g. carried-over weight) only while not focused. */
function Cell({
  value,
  onValue,
  placeholder,
  inputMode,
}: {
  value: number | undefined;
  onValue: (v: number | undefined) => void;
  placeholder: string;
  inputMode: "decimal" | "numeric";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value != null ? String(value) : "");
  }, [value]);
  return (
    <input
      ref={ref}
      inputMode={inputMode}
      className="h-11 w-full min-w-0 rounded-xl border border-white/[0.06] bg-ink-800 text-center tabular-nums outline-none focus:border-lime-400/60"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        onValue(parseCell(e.target.value));
      }}
    />
  );
}

function SetRow({
  set: s,
  metric,
  live,
  holding,
  onToggle,
  onStartHold,
}: {
  set: WorkoutSet;
  metric: ExerciseMetric;
  live: boolean;
  holding: boolean;
  onToggle: () => void;
  onStartHold: () => void;
}) {
  const range = s.targetRepMax ? (s.targetRepMin && s.targetRepMin !== s.targetRepMax ? `${s.targetRepMin}-${s.targetRepMax}` : `${s.targetRepMax}`) : "—";
  const rpe = (
    <Cell inputMode="decimal" value={s.rpe} placeholder="RPE" onValue={(v) => updateSet(s.id, { rpe: v != null ? Math.min(10, Math.max(1, v)) : undefined })} />
  );
  let inputs;
  switch (metric) {
    case "reps":
      inputs = (
        <>
          <Cell inputMode="decimal" value={s.weightKg} placeholder="—" onValue={(v) => updateSet(s.id, { weightKg: v })} />
          <Cell inputMode="numeric" value={s.reps} placeholder={range} onValue={(v) => updateSet(s.id, { reps: v })} />
          {rpe}
        </>
      );
      break;
    case "time":
      inputs = (
        <>
          <Cell inputMode="numeric" value={s.durationSec} placeholder={range} onValue={(v) => updateSet(s.id, { durationSec: v })} />
          {rpe}
          <button
            aria-label="Mulai timer"
            disabled={!live || s.completed || holding}
            onClick={onStartHold}
            className={cx(
              "grid h-11 w-11 place-items-center rounded-xl border border-white/10 transition active:scale-95 disabled:opacity-30",
              holding ? "bg-lime-400/20 text-lime-300" : "bg-ink-800 text-lime-400",
            )}
          >
            <Play className="size-4" fill="currentColor" />
          </button>
        </>
      );
      break;
    case "cardio":
      inputs = (
        <>
          <Cell
            inputMode="decimal"
            value={s.durationSec != null ? Math.round((s.durationSec / 60) * 10) / 10 : undefined}
            placeholder={range}
            onValue={(v) => updateSet(s.id, { durationSec: v != null ? Math.round(v * 60) : undefined })}
          />
          <Cell inputMode="decimal" value={s.distanceKm} placeholder="km" onValue={(v) => updateSet(s.id, { distanceKm: v })} />
          {rpe}
        </>
      );
      break;
    default: {
      const never: never = metric;
      throw new Error(`Unknown metric ${never}`);
    }
  }
  return (
    <div className={cx("grid items-center gap-1.5", GRID[metric], s.skipped && "opacity-40")}>
      <span className={cx("text-center text-sm font-bold", s.completed ? "text-lime-400" : "text-ink-400")}>{s.setNumber}</span>
      {inputs}
      <button
        aria-label={s.completed ? "Batalkan set" : "Set selesai"}
        onClick={onToggle}
        className={cx(
          "grid h-11 w-11 place-items-center rounded-xl transition active:scale-95",
          s.completed ? "bg-lime-400 text-ink-950" : "border border-white/10 bg-ink-800 text-ink-400",
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
    </div>
  );
}

function TechniqueSheet({ exercise, exerciseId, onClose }: { exercise?: Exercise; exerciseId?: string; onClose: () => void }) {
  return (
    <Sheet open={!!exerciseId} onClose={onClose} title={exercise?.name ?? "Teknik"}>
      {exerciseId && <ExerciseAnimation exerciseId={exerciseId} className="mx-auto max-w-xs" />}
      {exercise?.instructions && <p className="mt-3 text-sm leading-relaxed text-ink-300">{exercise.instructions}</p>}
      {!!exercise?.cues?.length && (
        <ul className="mt-3 space-y-1.5">
          {exercise.cues.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-lime-400" strokeWidth={3} />
              {c}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function SwapSheet({ from, candidates, onClose, onPick }: { from?: Exercise; candidates: Exercise[]; onClose: () => void; onPick: (id: string) => void }) {
  return (
    <Sheet open={!!from} onClose={onClose} title={`Ganti ${from?.name ?? ""}`}>
      <p className="mb-2 text-sm text-ink-400">Set yang sudah selesai tetap tercatat. Set sisanya pindah ke latihan pengganti.</p>
      {!candidates.length && <p className="py-6 text-center text-sm text-ink-400">Tidak ada pengganti dengan alat yang kamu punya.</p>}
      <div className="divide-y divide-white/[0.05]">
        {candidates.map((e) => (
          <button key={e.id} onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-white/5">
            <ExerciseThumb exerciseId={e.id} size={52} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{e.name}</div>
              <div className="truncate text-xs text-ink-400">
                {e.primaryMuscle} · {EQUIPMENT_LABEL[e.equipment]}
                {from?.alternatives.includes(e.id) && " · disarankan"}
              </div>
            </div>
            <Repeat className="size-4 shrink-0 text-lime-400" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function FinishSheet({
  open,
  onClose,
  incomplete,
  onFinish,
  onDraftChange,
}: {
  open: boolean;
  onClose: () => void;
  incomplete: number;
  onFinish: (p: { energyLevel?: number; hadPain: boolean; painNotes?: string; notes?: string }) => void;
  onDraftChange: (p: { energyLevel?: number }) => void;
}) {
  const [energy, setEnergy] = useState<number>();
  const [pain, setPain] = useState(false);
  const [painNotes, setPainNotes] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Selesaikan sesi"
      footer={
        <Button block onClick={() => onFinish({ energyLevel: energy, hadPain: pain, painNotes: painNotes.trim() || undefined, notes: notes.trim() || undefined })}>
          Simpan sesi
        </Button>
      }
    >
      {incomplete > 0 && <p className="mb-3 text-sm text-amber-300">{incomplete} set belum dicentang dan akan dicatat sebagai dilewati.</p>}
      <Field label="Level energi">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => {
                setEnergy(n);
                onDraftChange({ energyLevel: n });
              }}
              className={cx("h-11 flex-1 rounded-xl font-bold", energy === n ? "bg-lime-400 text-ink-950" : "bg-ink-800 text-ink-300")}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-3">
        <Toggle checked={pain} onChange={setPain} label="Ada nyeri / ketidaknyamanan" hint="Sesi berikutnya tidak akan menyarankan kenaikan beban." />
      </div>
      {pain && (
        <Field label="Di mana dan seperti apa?" className="mt-2">
          <TextArea value={painNotes} onChange={(e) => setPainNotes(e.target.value)} placeholder="mis. bahu kanan saat bench, nyeri tajam" />
        </Field>
      )}
      {pain && (
        <div className="mt-2">
          <Notice tone="warn">Bila nyeri tajam, menetap, atau disertai gejala lain, hentikan latihan terkait dan konsultasikan dengan tenaga kesehatan.</Notice>
        </div>
      )}
      <Field label="Catatan sesi" className="mt-3">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Sheet>
  );
}
