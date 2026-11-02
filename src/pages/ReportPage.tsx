import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Share2, Sparkles } from "lucide-react";
import { Button, Card, IconButton, MiniBars, Notice, Page, PageHeader, SectionTitle, useToast } from "../components/ui";
import { useLiveQuery } from "../hooks";
import { getWeeklyReport, weeklyReportMarkdown, weeklyReviewPrompt } from "../services/reports";
import { addDays, formatDayShort, parseLocalDate, startOfWeek, todayLocal, WEEKDAY_SHORT } from "../lib/date";
import { fmt1, fmtInt } from "../lib/format";
import { shareOrDownload } from "../lib/backup";

export default function ReportPage() {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const r = useLiveQuery(() => getWeeklyReport(weekStart), [weekStart]);
  const isCurrent = weekStart === startOfWeek(todayLocal());

  return (
    <Page>
      <PageHeader back title="Laporan mingguan" />

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-ink-850 p-1">
        <IconButton label="Minggu sebelumnya" className="border-0 bg-transparent" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <span className="font-semibold">
          {formatDayShort(weekStart)} – {formatDayShort(addDays(weekStart, 6))}
        </span>
        <IconButton label="Minggu berikutnya" className="border-0 bg-transparent" disabled={isCurrent} onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="size-5" />
        </IconButton>
      </div>

      {r && (
        <>
          <Card className="bg-lime-radial">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-widest text-ink-400">Kalori harian</span>
              <span className="text-xs text-ink-400">{r.loggedDays}/7 hari tercatat</span>
            </div>
            <div className="mt-1 font-display text-3xl font-bold">
              {r.avgKcal != null ? fmtInt(r.avgKcal) : "—"} <span className="text-sm font-medium text-ink-400">kkal rata-rata</span>
            </div>
            <div className="mt-3">
              <MiniBars
                values={r.perDay.map((d) => (d.logged ? d.kcal : undefined))}
                target={r.goal?.caloriesKcal}
                labels={r.perDay.map((d) => WEEKDAY_SHORT[parseLocalDate(d.localDate).getDay()])}
              />
            </div>
            <p className="mt-2 text-xs text-ink-500">Garis putus-putus = target. Rata-rata hanya dari hari yang tercatat.</p>
          </Card>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Tile label="Protein" value={`${fmtInt(r.avgProtein)} g`} sub={r.goal ? `target ${r.goal.proteinG}` : undefined} />
            <Tile label="Karbo" value={`${fmtInt(r.avgCarbs)} g`} />
            <Tile label="Lemak" value={`${fmtInt(r.avgFat)} g`} />
          </div>

          {r.loggedDays < 5 && (
            <div className="mt-3">
              <Notice tone="warn">Pencatatan baru {r.loggedDays} dari 7 hari — rata-rata minggu ini mungkin belum mewakili pola makan sebenarnya.</Notice>
            </div>
          )}

          <SectionTitle>Aktivitas & latihan</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Aktivitas" value={`${r.activityCount}×`} sub={`${fmtInt(r.activityMinutes)} menit`} />
            <Tile label="Rata-rata langkah" value={r.avgSteps != null ? fmtInt(r.avgSteps) : "—"} />
            <Tile label="Sesi beban" value={`${r.sessionsCompleted}`} sub={`${r.setsCompleted} set`} />
            <Tile label="Volume" value={`${fmtInt(r.volume)} kg`} sub={r.painSessions ? `${r.painSessions} sesi nyeri` : undefined} />
          </div>

          <SectionTitle>Tubuh</SectionTitle>
          <Card>
            {r.weightStart && r.weightEnd ? (
              <div className="text-sm">
                Berat: <b>{fmt1(r.weightStart.weightKg)}</b> → <b>{fmt1(r.weightEnd.weightKg)}</b> kg
                {r.weightStart.avg7 != null && r.weightEnd.avg7 != null && (
                  <div className="text-ink-400">
                    rata-rata 7 hari {fmt1(r.weightStart.avg7)} → {fmt1(r.weightEnd.avg7)} kg
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-ink-400">Belum cukup data berat minggu ini.</div>
            )}
            {r.waistStart != null && (
              <div className="mt-1 text-sm">
                Pinggang: {fmt1(r.waistStart)} → {fmt1(r.waistEnd)} cm
              </div>
            )}
          </Card>

          {r.topFoods.length > 0 && (
            <>
              <SectionTitle>Paling sering dicatat</SectionTitle>
              <Card className="space-y-1.5">
                {r.topFoods.map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="truncate">{name}</span>
                    <span className="text-ink-400">{count}×</span>
                  </div>
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Ekspor & AI review</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              icon={<Share2 className="size-4" />}
              onClick={() =>
                shareOrDownload(new File([weeklyReportMarkdown(r)], `vitalime-laporan-${weekStart}.md`, { type: "text/markdown" }))
              }
            >
              Markdown
            </Button>
            <Button
              variant="secondary"
              icon={<Copy className="size-4" />}
              onClick={async () => {
                await navigator.clipboard?.writeText(weeklyReportMarkdown(r));
                toast("Laporan disalin");
              }}
            >
              Salin teks
            </Button>
          </div>
          <Button
            block
            className="mt-2"
            icon={<Sparkles className="size-4" />}
            onClick={async () => {
              const text = weeklyReviewPrompt(r);
              try {
                if (navigator.canShare?.({ text })) return void (await navigator.share({ text }));
              } catch (e) {
                if ((e as DOMException).name === "AbortError") return;
              }
              await navigator.clipboard?.writeText(text);
              toast("Prompt review disalin — tempel di aplikasi AI");
            }}
          >
            Minta AI review (teks saja)
          </Button>
          <p className="mt-2 px-1 text-xs text-ink-500">
            Hanya ringkasan teks di atas yang dibagikan — tanpa foto. AI tidak mengubah target atau program secara otomatis.
          </p>
        </>
      )}
    </Page>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-ink-400">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-ink-500">{sub}</div>}
    </Card>
  );
}
