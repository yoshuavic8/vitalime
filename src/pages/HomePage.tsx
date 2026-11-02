import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  HardDrive,
  Moon,
  Play,
  Plus,
  Scale,
  Settings,
  Share,
  SquarePlus,
  Wifi,
  WifiOff,
  Activity as ActivityIcon,
} from "lucide-react";
import { Badge, Card, IconButton, MacroBar, Notice, Page, PageHeader, Ring, SectionTitle } from "../components/ui";
import { useLiveQuery, useOnline } from "../hooks";
import { getDaySummary } from "../services/reports";
import { getProfile, getSetting, SETTING_KEYS } from "../db/repo/settings";
import { getInProgressSession, scheduledDaysFor } from "../db/repo/training";
import { daysBetween, formatDateTime, formatDayLong, formatTime, todayLocal, toLocalDate } from "../lib/date";
import { fmt1, fmtDuration, fmtInt } from "../lib/format";
import { isIos, isStandalone } from "../lib/storage";

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

export default function HomePage() {
  const navigate = useNavigate();
  const online = useOnline();
  const today = todayLocal();
  const summary = useLiveQuery(() => getDaySummary(today), [today]);
  const profile = useLiveQuery(getProfile);
  const lastBackupAt = useLiveQuery(() => getSetting<string>(SETTING_KEYS.lastBackupAt));
  const training = useLiveQuery(async () => {
    const [inProgress, scheduled] = await Promise.all([getInProgressSession(), scheduledDaysFor(new Date().getDay())]);
    return { inProgress, ...scheduled };
  });

  const intake = summary?.intake.kcal ?? 0;
  const target = summary?.target;
  const remaining = target != null ? target - intake : undefined;
  const backupAge = lastBackupAt ? daysBetween(toLocalDate(lastBackupAt), today) : undefined;

  return (
    <Page>
      <PageHeader
        subtitle={formatDayLong(today)}
        title={profile?.name ? `${greeting()}, ${profile.name.split(" ")[0]}` : greeting()}
        right={
          <IconButton label="Pengaturan" onClick={() => navigate("/settings")}>
            <Settings className="size-5" />
          </IconButton>
        }
      />

      {!isStandalone() && (
        <Card className="mb-3 border-lime-400/20">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-400/15 text-lime-400">
              <SquarePlus className="size-5" />
            </div>
            <div className="text-sm">
              <div className="font-semibold">Pasang ke Home Screen</div>
              <p className="mt-0.5 text-ink-400">
                {isIos() ? (
                  <>
                    Di Safari, ketuk <Share className="inline size-4 align-[-3px] text-lime-400" /> Share → <b>Add to Home Screen</b>. Setelah
                    itu Vitalime berjalan offline seperti aplikasi biasa, tanpa Apple Developer.
                  </>
                ) : (
                  <>Buka di Safari iPhone lalu pilih Share → Add to Home Screen.</>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {summary?.goalIsDefault && (
        <Card className="mb-3" onClick={() => navigate("/settings")}>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">
              <div className="font-semibold">Atur target harian</div>
              <div className="text-ink-400">Kalori & makro default dipakai sampai kamu menyesuaikannya.</div>
            </div>
            <ChevronRight className="size-5 text-ink-400" />
          </div>
        </Card>
      )}

      {/* Energy intake hero */}
      <Card className="bg-lime-radial overflow-hidden" onClick={() => navigate("/food")}>
        <div className="flex items-center gap-4">
          <Ring value={intake} max={target ?? 2000} size={150} stroke={13}>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-ink-400">{remaining != null && remaining < 0 ? "Lebih" : "Sisa"}</div>
              <div className="font-display text-3xl font-bold tabular-nums">{remaining != null ? fmtInt(Math.abs(remaining)) : "—"}</div>
              <div className="text-xs text-ink-400">kkal</div>
            </div>
          </Ring>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-ink-400">Energy intake</div>
              <div className="font-display text-2xl font-bold tabular-nums">
                {summary?.food.length ? fmtInt(intake) : <span className="text-base font-medium text-ink-400">belum tercatat</span>}
              </div>
              <div className="text-xs text-ink-400">
                target {fmtInt(target)} kkal
                {summary?.goal?.targetMode === "activity_adjusted" && summary.energy.activeKcal ? " (+aktif)" : ""}
              </div>
            </div>
            <MacroBar label="Protein" value={summary?.intake.protein ?? 0} target={summary?.goal?.proteinG} color="var(--color-protein)" />
            <MacroBar label="Karbo" value={summary?.intake.carbs ?? 0} target={summary?.goal?.carbsG} color="var(--color-carbs)" />
            <MacroBar label="Lemak" value={summary?.intake.fat ?? 0} target={summary?.goal?.fatG} color="var(--color-fat)" />
          </div>
        </div>
        {!!summary?.drafts && (
          <div className="mt-3">
            <Badge tone="warn">{summary.drafts} entri masih draft estimasi</Badge>
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={() => navigate("/food/new")}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-lime-400 py-3 text-xs font-bold text-ink-950 active:scale-95"
        >
          <Plus className="size-5" />
          Makanan
        </button>
        {/* A real <input> under the tap so iOS opens the camera directly, then the AI sheet. */}
        <label className="flex flex-col items-center gap-1.5 rounded-2xl border border-lime-400/35 bg-lime-400/10 py-3 text-xs font-semibold text-lime-300 active:scale-95">
          <Camera className="size-5" />
          Foto AI
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) navigate("/food/new", { state: { file } });
            }}
          />
        </label>
        {[
          { label: "Berat", icon: Scale, to: "/progress?add=1" },
          { label: "Aktivitas", icon: ActivityIcon, to: "/activity?add=1" },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-ink-850 py-3 text-xs font-semibold text-ink-100 active:scale-95"
          >
            <a.icon className="size-5" />
            {a.label}
          </button>
        ))}
      </div>

      {/* Energy expenditure — kept separate from intake on purpose */}
      <SectionTitle>Aktivitas hari ini</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<Flame className="size-4" />}
          label="Aktif"
          value={summary?.energy.activeKcal != null ? fmtInt(summary.energy.activeKcal) : undefined}
          unit="kkal"
          foot={summary?.energy.activeSource === "health" ? "Apple Health" : summary?.energy.activeSource === "activities" ? "dari aktivitas" : undefined}
        />
        <Stat
          icon={<Moon className="size-4" />}
          label="Resting"
          value={summary?.energy.restingKcal != null ? fmtInt(summary.energy.restingKcal) : undefined}
          unit="kkal"
          foot={summary?.energy.restingKcal != null ? "Apple Health" : undefined}
        />
        <Stat
          icon={<Footprints className="size-4" />}
          label="Langkah"
          value={summary?.health.steps != null ? fmtInt(summary.health.steps) : undefined}
          foot={summary?.goal?.stepsTarget ? `target ${fmtInt(summary.goal.stepsTarget)}` : undefined}
        />
      </div>

      {summary?.activities.length ? (
        <Card className="mt-2" onClick={() => navigate("/activity")}>
          <div className="space-y-2">
            {summary.activities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 place-items-center rounded-xl bg-white/[0.05] text-lime-400">
                  <ActivityIcon className="size-4" />
                </span>
                <span className="flex-1 truncate font-medium">{a.activityType}</span>
                <span className="text-ink-400">{fmtDuration(a.durationMinutes)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Training */}
      <SectionTitle>Latihan</SectionTitle>
      {training?.inProgress ? (
        <Card glow onClick={() => navigate(`/training/session/${training.inProgress!.id}`)}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-lime-400 text-ink-950">
              <Play className="size-5" fill="currentColor" />
            </span>
            <div className="flex-1">
              <div className="font-semibold">{training.inProgress.name}</div>
              <div className="text-sm text-ink-400">Sedang berlangsung sejak {formatTime(training.inProgress.startedAt)}</div>
            </div>
            <ChevronRight className="size-5 text-ink-400" />
          </div>
        </Card>
      ) : training?.days.length ? (
        <Card onClick={() => navigate("/training")}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-lime-400/15 text-lime-400">
              <Dumbbell className="size-5" />
            </span>
            <div className="flex-1">
              <div className="font-semibold">{training.days.map((d) => d.name).join(" / ")}</div>
              <div className="text-sm text-ink-400">Terjadwal hari ini · {training.program?.name}</div>
            </div>
            <ChevronRight className="size-5 text-ink-400" />
          </div>
        </Card>
      ) : (
        <Card onClick={() => navigate("/training")}>
          <div className="flex items-center gap-3 text-sm">
            <Dumbbell className="size-5 text-ink-400" />
            <span className="flex-1 text-ink-300">
              {training?.program ? "Hari istirahat sesuai jadwal program." : "Belum ada program latihan aktif."}
            </span>
            <ChevronRight className="size-5 text-ink-400" />
          </div>
        </Card>
      )}

      {/* Body */}
      <SectionTitle>Tubuh</SectionTitle>
      <Card onClick={() => navigate("/progress")}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/[0.05] text-lime-400">
            <Scale className="size-5" />
          </span>
          <div className="flex-1">
            <div className="text-xs text-ink-400">Berat terakhir</div>
            {summary?.weight ? (
              <div className="font-display text-xl font-bold">
                {fmt1(summary.weight.weightKg)} <span className="text-sm font-medium text-ink-400">kg</span>
              </div>
            ) : (
              <div className="font-medium text-ink-300">belum tercatat</div>
            )}
          </div>
          {summary?.weight && <span className="text-xs text-ink-400">{formatDateTime(summary.weight.measuredAt)}</span>}
        </div>
      </Card>

      {(backupAge == null || backupAge >= 7) && (
        <div className="mt-4">
          <Notice tone="warn">
            <div className="flex items-start gap-2">
              <HardDrive className="mt-0.5 size-4 shrink-0" />
              <span>
                {backupAge == null ? "Belum pernah backup." : `Backup terakhir ${backupAge} hari lalu.`} Data hanya ada di iPhone ini —{" "}
                <button className="font-semibold underline" onClick={() => navigate("/settings#backup")}>
                  backup sekarang
                </button>
                .
              </span>
            </div>
          </Notice>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-400">
        <span className="flex items-center gap-1">
          {online ? <Wifi className="size-3.5 text-lime-400" /> : <WifiOff className="size-3.5" />}
          {online ? "Online" : "Offline"}
        </span>
        <span>
          Impor Health: {summary?.lastHealthImport ? formatDateTime(summary.lastHealthImport.importedAt) : "belum pernah"}
        </span>
      </div>
    </Page>
  );
}

function Stat({ icon, label, value, unit, foot }: { icon: ReactNode; label: string; value?: string; unit?: string; foot?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 truncate text-[11px] font-medium text-ink-400">
        <span className="shrink-0 text-lime-400">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold tabular-nums">
        {value ?? <span className="text-ink-500">—</span>}
        {value && unit && <span className="ml-0.5 text-xs font-medium text-ink-400">{unit}</span>}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-ink-500">{value ? foot : "belum tercatat"}</div>
    </Card>
  );
}
