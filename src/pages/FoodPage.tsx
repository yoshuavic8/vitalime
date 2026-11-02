import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Search, Star, Utensils } from "lucide-react";
import { Badge, BlobImage, Card, EmptyState, IconButton, Page, PageHeader, Sheet, TextInput, cx } from "../components/ui";
import { useLiveQuery } from "../hooks";
import { firstThumbsFor, listFoodByDate, listTemplates, searchFoodHistory } from "../db/repo/food";
import { getGoalOrDefault } from "../db/repo/settings";
import { MEAL_TYPES, type FoodEntry } from "../db/types";
import { addDays, formatTime, relativeDayLabel, todayLocal } from "../lib/date";
import { fmtInt } from "../lib/format";
import { MEAL_LABEL, VERIFICATION_LABEL } from "../lib/labels";
import { totals } from "../services/reports";

export default function FoodPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get("d") ?? todayLocal();
  const setDate = (d: string) => setParams(d === todayLocal() ? {} : { d }, { replace: true });
  const [searchOpen, setSearchOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);

  const data = useLiveQuery(async () => {
    const entries = await listFoodByDate(date);
    const [thumbs, { goal }] = await Promise.all([firstThumbsFor(entries.map((e) => e.id)), getGoalOrDefault(date)]);
    return { entries, thumbs, goal };
  }, [date]);

  const t = totals(data?.entries ?? []);
  const newUrl = (extra: Record<string, string> = {}) =>
    `/food/new?${new URLSearchParams({ d: date, ...extra }).toString()}`;

  return (
    <Page>
      <PageHeader
        title="Food Journal"
        right={
          <>
            <IconButton label="Favorit" onClick={() => setFavOpen(true)}>
              <Star className="size-5" />
            </IconButton>
            <IconButton label="Cari riwayat" onClick={() => setSearchOpen(true)}>
              <Search className="size-5" />
            </IconButton>
          </>
        }
      />

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-ink-850 p-1">
        <IconButton label="Hari sebelumnya" className="border-0 bg-transparent" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <label className="relative text-center">
          <span className="font-semibold">{relativeDayLabel(date)}</span>
          <input
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0"
          />
        </label>
        <IconButton
          label="Hari berikutnya"
          className="border-0 bg-transparent"
          disabled={date >= todayLocal()}
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight className="size-5" />
        </IconButton>
      </div>

      <Card className="bg-lime-radial">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-400">Total intake</div>
            <div className="font-display text-3xl font-bold tabular-nums">
              {data?.entries.length ? fmtInt(t.kcal) : "—"}
              <span className="ml-1 text-sm font-medium text-ink-400">/ {fmtInt(data?.goal?.caloriesKcal)} kkal</span>
            </div>
          </div>
          <div className="text-right text-xs text-ink-400">{data?.entries.length ?? 0} entri</div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Macro label="Protein" value={t.protein} color="text-protein" />
          <Macro label="Karbo" value={t.carbs} color="text-carbs" />
          <Macro label="Lemak" value={t.fat} color="text-fat" />
        </div>
      </Card>

      {data && data.entries.length === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={<Utensils className="size-6" />}
            title="Belum ada catatan"
            text="Catat makanan pertama hari ini. Foto bisa disimpan dulu walau offline."
          />
        </div>
      )}

      {MEAL_TYPES.map((meal) => {
        const items = data?.entries.filter((e) => e.mealType === meal) ?? [];
        const mt = totals(items);
        return (
          <section key={meal} className="mt-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-semibold">
                {MEAL_LABEL[meal]}
                {items.length > 0 && <span className="ml-2 text-sm font-normal text-ink-400">{fmtInt(mt.kcal)} kkal</span>}
              </h2>
              <button
                onClick={() => navigate(newUrl({ meal }))}
                className="grid size-8 place-items-center rounded-full bg-lime-400/12 text-lime-400 active:scale-95"
                aria-label={`Tambah ${MEAL_LABEL[meal]}`}
              >
                <Plus className="size-4" />
              </button>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((e) => (
                  <FoodRow key={e.id} entry={e} thumb={data?.thumbs[e.id]} onClick={() => navigate(`/food/${e.id}`)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <button
        onClick={() => navigate(newUrl())}
        className="glow-lime fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-5 z-20 grid size-14 place-items-center rounded-full bg-lime-400 text-ink-950 active:scale-95"
        aria-label="Tambah makanan"
      >
        <Plus className="size-7" strokeWidth={2.6} />
      </button>

      <HistorySheet open={searchOpen} onClose={() => setSearchOpen(false)} onPick={(e) => navigate(newUrl({ from: e.id }))} />
      <FavoritesSheet open={favOpen} onClose={() => setFavOpen(false)} onPick={(id) => navigate(newUrl({ template: id }))} />
    </Page>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-black/25 py-2">
      <div className={cx("font-display text-lg font-bold tabular-nums", color)}>{Math.round(value)}g</div>
      <div className="text-[11px] text-ink-400">{label}</div>
    </div>
  );
}

export function FoodRow({ entry: e, thumb, onClick }: { entry: FoodEntry; thumb?: Blob; onClick: () => void }) {
  return (
    <Card className="p-2.5" onClick={onClick}>
      <div className="flex items-center gap-3">
        {thumb ? (
          <BlobImage blob={thumb} alt={e.name} className="size-14 shrink-0 rounded-2xl" />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/[0.04] text-ink-500">
            <Utensils className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{e.name}</span>
            {e.verification === "draft" && <Badge tone="warn">{VERIFICATION_LABEL.draft}</Badge>}
            {e.source === "ai_estimate" && e.verification !== "draft" && <Badge tone="info">AI</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-400">
            {formatTime(e.consumedAt)}
            {e.portionValue != null && ` · ${e.portionValue} ${e.portionUnit ?? ""}`}
            {" · "}P {fmtInt(e.proteinG)} · K {fmtInt(e.carbsG)} · L {fmtInt(e.fatG)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold tabular-nums">{fmtInt(e.caloriesKcal)}</div>
          <div className="text-[10px] text-ink-400">kkal</div>
        </div>
      </div>
    </Card>
  );
}

function HistorySheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: FoodEntry) => void }) {
  const [q, setQ] = useState("");
  const results = useLiveQuery(() => (open ? searchFoodHistory(q) : Promise.resolve([])), [q, open]);
  return (
    <Sheet open={open} onClose={onClose} title="Cari riwayat makanan">
      <TextInput autoFocus placeholder="mis. nasi goreng" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 space-y-1">
        {results?.map((e) => (
          <button key={e.id} onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-white/5">
            <span className="flex-1 truncate">{e.name}</span>
            <span className="text-sm tabular-nums text-ink-400">{fmtInt(e.caloriesKcal)} kkal</span>
          </button>
        ))}
        {results?.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Tidak ada hasil.</p>}
      </div>
    </Sheet>
  );
}

function FavoritesSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const templates = useLiveQuery(listTemplates);
  return (
    <Sheet open={open} onClose={onClose} title="Makanan favorit">
      {!templates?.length && (
        <p className="py-6 text-center text-sm text-ink-400">
          Belum ada favorit. Aktifkan “Simpan sebagai favorit” saat mencatat makanan.
        </p>
      )}
      <div className="space-y-1">
        {templates?.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-white/5">
            <Star className="size-4 text-lime-400" />
            <span className="flex-1 truncate">{t.name}</span>
            <span className="text-sm tabular-nums text-ink-400">{fmtInt(t.caloriesKcal)} kkal</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
