import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Camera, ChevronLeft, Globe, Loader2, Minus, Plus, Search, Trash2, WifiOff } from "lucide-react";
import { Badge, Button, Chip, NumberInput, Notice, Segmented, Sheet, TextInput, cx, useToast } from "./ui";
import { useOnline } from "../hooks";
import { FOOD_CATEGORY_LABEL, FOODS, type FoodCategory, type FoodItem, type Serving } from "../data/foods";
import type { FoodItemLine } from "../db/types";
import { lineFromFood, scaleNutrients, searchFoods, sumLines, type Per100 } from "../lib/foodCalc";
import { lookupBarcode, searchProducts, type OffProduct } from "../lib/openFoodFacts";
import { decodeBarcode } from "../lib/barcode";
import { fmt1, fmtInt } from "../lib/format";

type Tab = "local" | "online" | "barcode";

/** What the amount picker needs, regardless of where the food came from. */
type Candidate = {
  name: string;
  per100: Per100;
  unit: "g" | "ml";
  servings: Serving[];
  toLine: (grams: number, serving?: string) => FoodItemLine;
  note?: string;
};

const fromLocal = (f: FoodItem): Candidate => ({
  name: f.name,
  per100: f,
  unit: f.unit,
  servings: f.servings,
  toLine: (grams, serving) => lineFromFood(f, grams, serving),
});

const fromOff = (p: OffProduct): Candidate => {
  const name = p.brand ? `${p.name} (${p.brand})` : p.name;
  return {
    name,
    per100: p.per100,
    unit: "g",
    servings: p.servingGrams ? [{ label: p.servingLabel ? `1 saji (${p.servingLabel})` : "1 saji", grams: p.servingGrams }] : [],
    toLine: (grams, serving) => ({ name, grams: Math.round(grams), serving, ...scaleNutrients(p.per100, grams), source: "open_food_facts", refId: p.code }),
    note: "Data label kemasan dari Open Food Facts (kontribusi publik) — cek dengan label di kemasanmu.",
  };
};

const lineLabel = (l: FoodItemLine) => l.serving ?? `${fmtInt(l.grams)} g`;

export function FoodLookupSheet({
  open,
  onClose,
  initialItems,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  initialItems: FoodItemLine[];
  onApply: (items: FoodItemLine[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("local");
  const [plate, setPlate] = useState<FoodItemLine[]>(initialItems);
  const [picking, setPicking] = useState<Candidate>();

  useEffect(() => {
    if (open) {
      setPlate(initialItems);
      setPicking(undefined);
    }
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = sumLines(plate);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={picking ? "Berapa banyak?" : "Cari kalori makanan"}
      footer={
        !picking && (
          <Button block disabled={!plate.length} onClick={() => onApply(plate)}>
            {plate.length ? `Pakai ${plate.length} item · ${fmtInt(total.caloriesKcal)} kkal` : "Pilih makanan dulu"}
          </Button>
        )
      }
    >
      {picking ? (
        <AmountPicker
          candidate={picking}
          onBack={() => setPicking(undefined)}
          onAdd={(line) => {
            setPlate((p) => [...p, line]);
            setPicking(undefined);
          }}
        />
      ) : (
        <>
          {plate.length > 0 && <PlateList plate={plate} onRemove={(i) => setPlate((p) => p.filter((_, j) => j !== i))} total={total} />}
          <Segmented<Tab>
            className="mt-1"
            value={tab}
            onChange={setTab}
            options={[
              { value: "local", label: "Database" },
              { value: "online", label: "Online" },
              { value: "barcode", label: "Barcode" },
            ]}
          />
          <div className="mt-3">
            {tab === "local" && <LocalTab onPick={(f) => setPicking(fromLocal(f))} />}
            {tab === "online" && <OnlineTab onPick={(p) => setPicking(fromOff(p))} />}
            {tab === "barcode" && <BarcodeTab onPick={(p) => setPicking(fromOff(p))} />}
          </div>
        </>
      )}
    </Sheet>
  );
}

function PlateList({ plate, total, onRemove }: { plate: FoodItemLine[]; total: ReturnType<typeof sumLines>; onRemove: (i: number) => void }) {
  return (
    <div className="mb-3 rounded-2xl border border-lime-400/25 bg-lime-400/[0.05] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-lime-300">Piring kamu</span>
        <span className="font-display text-lg font-bold tabular-nums">{fmtInt(total.caloriesKcal)} kkal</span>
      </div>
      <div className="mt-0.5 text-xs text-ink-400">
        P {fmt1(total.proteinG)} g · K {fmt1(total.carbsG)} g · L {fmt1(total.fatG)} g
      </div>
      <div className="mt-2 space-y-1">
        {plate.map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {l.name} <span className="text-ink-400">· {lineLabel(l)}</span>
            </span>
            <span className="tabular-nums text-ink-300">{fmtInt(l.caloriesKcal)}</span>
            <button aria-label={`Hapus ${l.name}`} className="grid size-7 place-items-center rounded-full text-ink-400 active:bg-white/5" onClick={() => onRemove(i)}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FoodRow({ title, subtitle, kcal, unit, onClick }: { title: string; subtitle?: string; kcal: number; unit: "g" | "ml"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-white/5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-ink-400">{subtitle}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums">{fmtInt(kcal)}</div>
        <div className="text-[10px] text-ink-500">kkal/100 {unit}</div>
      </div>
      <Plus className="size-5 shrink-0 text-lime-400" />
    </button>
  );
}

function LocalTab({ onPick }: { onPick: (f: FoodItem) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FoodCategory>("karbo");
  const results = useMemo(() => (q.trim() ? searchFoods(q) : FOODS.filter((f) => f.category === cat)), [q, cat]);
  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
        <TextInput className="pl-10" placeholder="mis. nasi, tempe, sate, pisang" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!q.trim() && (
        <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5">
          {(Object.entries(FOOD_CATEGORY_LABEL) as [FoodCategory, string][]).map(([k, v]) => (
            <Chip key={k} active={cat === k} onClick={() => setCat(k)}>
              {v}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-1 divide-y divide-white/[0.05]">
        {results.map((f) => (
          <FoodRow key={f.id} title={f.name} subtitle={f.servings.map((s) => `${s.label} ${s.grams} ${f.unit}`).join(" · ")} kcal={f.kcal} unit={f.unit} onClick={() => onPick(f)} />
        ))}
        {q.trim() && !results.length && (
          <p className="py-6 text-center text-sm text-ink-400">Tidak ditemukan di database lokal. Coba tab Online untuk produk kemasan, atau isi manual.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        {FOODS.length} makanan umum Indonesia. Angka adalah perkiraan (TKPI/USDA) — porsi, minyak, dan santan bisa membuat nilai aslinya berbeda.
      </p>
    </>
  );
}

function OnlineTab({ onPick }: { onPick: (p: OffProduct) => void }) {
  const online = useOnline();
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; results: OffProduct[] }>({ status: "idle", results: [] });
  const abort = useRef<AbortController>(undefined);

  const run = async () => {
    if (!q.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ status: "loading", results: [] });
    try {
      setState({ status: "done", results: await searchProducts(q.trim(), ctrl.signal) });
    } catch {
      if (!ctrl.signal.aborted) setState({ status: "error", results: [] });
    }
  };
  useEffect(() => () => abort.current?.abort(), []);

  if (!online) return <OfflineNotice />;
  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <TextInput placeholder="Nama produk / merek, mis. indomie" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" disabled={state.status === "loading"} icon={state.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}>
          Cari
        </Button>
      </form>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
        <Globe className="mt-0.5 size-3.5 shrink-0" />
        Mencari di Open Food Facts (database publik produk kemasan). Hanya kata pencarian yang dikirim.
      </p>
      {state.status === "error" && (
        <div className="mt-3">
          <Notice tone="warn">Pencarian gagal. Server Open Food Facts mungkin sibuk — coba lagi sebentar lagi.</Notice>
        </div>
      )}
      <div className="mt-1 divide-y divide-white/[0.05]">
        {state.results.map((p) => (
          <FoodRow key={p.code} title={p.name} subtitle={[p.brand, p.servingLabel && `saji ${p.servingLabel}`].filter(Boolean).join(" · ")} kcal={p.per100.kcal} unit="g" onClick={() => onPick(p)} />
        ))}
        {state.status === "done" && !state.results.length && <p className="py-6 text-center text-sm text-ink-400">Tidak ada hasil dengan data kalori.</p>}
      </div>
    </>
  );
}

function BarcodeTab({ onPick }: { onPick: (p: OffProduct) => void }) {
  const online = useOnline();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"decode" | "lookup">();

  const lookup = async (value: string) => {
    setBusy("lookup");
    try {
      const p = await lookupBarcode(value);
      if (p) onPick(p);
      else toast("Produk belum ada di Open Food Facts — isi manual dari label kemasan");
    } catch {
      toast("Gagal menghubungi Open Food Facts");
    } finally {
      setBusy(undefined);
    }
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy("decode");
    try {
      const found = await decodeBarcode(file);
      if (!found) {
        toast("Barcode tidak terbaca. Foto lebih dekat & terang, atau ketik angkanya.");
        setBusy(undefined);
        return;
      }
      setCode(found);
      await lookup(found);
    } catch {
      toast("Gagal membaca foto");
      setBusy(undefined);
    }
  };

  if (!online) return <OfflineNotice />;
  return (
    <>
      <Button
        block
        variant="secondary"
        className="h-24 flex-col border-dashed border-lime-400/40"
        disabled={!!busy}
        icon={busy === "decode" ? <Loader2 className="size-6 animate-spin text-lime-400" /> : <Camera className="size-6 text-lime-400" />}
        onClick={() => fileRef.current?.click()}
      >
        {busy === "decode" ? "Membaca barcode…" : "Foto barcode kemasan"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void fromPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void lookup(code.trim());
        }}
      >
        <TextInput inputMode="numeric" placeholder="atau ketik angka barcode" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Button type="submit" disabled={!code || !!busy} icon={busy === "lookup" ? <Loader2 className="size-4 animate-spin" /> : <Barcode className="size-4" />}>
          Cek
        </Button>
      </form>
      <p className="mt-2 text-xs text-ink-500">Barcode dibaca di perangkat. Hanya angka barcode yang dikirim ke Open Food Facts untuk mengambil info gizi.</p>
    </>
  );
}

function OfflineNotice() {
  return (
    <Notice tone="info">
      <div className="flex gap-2">
        <WifiOff className="mt-0.5 size-4 shrink-0" />
        Fitur ini butuh internet. Database lokal tetap bisa dipakai offline.
      </div>
    </Notice>
  );
}

function AmountPicker({ candidate: c, onBack, onAdd }: { candidate: Candidate; onBack: () => void; onAdd: (line: FoodItemLine) => void }) {
  const [servingIdx, setServingIdx] = useState<number>(c.servings.length ? 0 : -1);
  const [qty, setQty] = useState<number | undefined>(1);
  const [grams, setGrams] = useState<number | undefined>(100);
  const serving = servingIdx >= 0 ? c.servings[servingIdx] : undefined;
  const totalGrams = serving ? serving.grams * (qty ?? 0) : (grams ?? 0);
  const n = scaleNutrients(c.per100, totalGrams);
  const servingText = serving ? (qty === 1 ? serving.label : `${fmt1(qty)} × ${serving.label}`) : undefined;
  const step = (d: number) => setQty((q) => Math.max(0.5, Math.round(((q ?? 0) + d) * 2) / 2));

  return (
    <div>
      <button className="-ml-1 mb-2 flex items-center gap-1 text-sm text-ink-400" onClick={onBack}>
        <ChevronLeft className="size-4" /> Kembali
      </button>
      <div className="font-display text-xl font-bold">{c.name}</div>
      <div className="text-xs text-ink-400">
        per 100 {c.unit}: {fmtInt(c.per100.kcal)} kkal · P {fmt1(c.per100.protein)} · K {fmt1(c.per100.carbs)} · L {fmt1(c.per100.fat)}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.servings.map((s, i) => (
          <Chip key={s.label} active={servingIdx === i} onClick={() => setServingIdx(i)}>
            {s.label} · {fmtInt(s.grams)} {c.unit}
          </Chip>
        ))}
        <Chip active={servingIdx === -1} onClick={() => setServingIdx(-1)}>
          Isi {c.unit === "ml" ? "ml" : "gram"}
        </Chip>
      </div>

      <div className="mt-3">
        {serving ? (
          <div className="flex items-center gap-2">
            <button aria-label="Kurangi" className="grid size-12 place-items-center rounded-2xl bg-ink-800 active:scale-95" onClick={() => step(-0.5)}>
              <Minus className="size-5" />
            </button>
            <NumberInput className="flex-1 [&_input]:text-center" value={qty} onChange={setQty} suffix="×" />
            <button aria-label="Tambah" className="grid size-12 place-items-center rounded-2xl bg-ink-800 active:scale-95" onClick={() => step(0.5)}>
              <Plus className="size-5" />
            </button>
          </div>
        ) : (
          <NumberInput value={grams} onChange={setGrams} suffix={c.unit} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Macro label="kkal" value={fmtInt(n.caloriesKcal)} highlight />
        <Macro label="protein" value={`${fmt1(n.proteinG)} g`} />
        <Macro label="karbo" value={`${fmt1(n.carbsG)} g`} />
        <Macro label="lemak" value={`${fmt1(n.fatG)} g`} />
      </div>
      <div className="mt-1 text-center text-xs text-ink-500">
        Total {fmtInt(totalGrams)} {c.unit}
      </div>
      {c.note && (
        <div className="mt-3 flex gap-2">
          <Badge tone="info">OFF</Badge>
          <p className="text-xs text-ink-400">{c.note}</p>
        </div>
      )}

      <Button block className="mt-4" disabled={totalGrams <= 0} icon={<Plus className="size-4" />} onClick={() => onAdd(c.toLine(totalGrams, servingText))}>
        Tambah ke piring
      </Button>
    </div>
  );
}

function Macro({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cx("rounded-2xl p-2", highlight ? "bg-lime-400 text-ink-950" : "bg-ink-800")}>
      <div className="font-display text-base font-bold tabular-nums">{value}</div>
      <div className={cx("text-[10px]", highlight ? "text-ink-900" : "text-ink-400")}>{label}</div>
    </div>
  );
}
