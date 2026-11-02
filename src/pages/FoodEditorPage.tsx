import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Camera, Copy, ImagePlus, Search, Sparkles, Star, Trash2, X } from "lucide-react";
import {
  Badge,
  BlobImage,
  Button,
  Card,
  Field,
  NumberInput,
  Page,
  PageHeader,
  Segmented,
  Select,
  TextArea,
  TextInput,
  Toggle,
  cx,
  useToast,
} from "../components/ui";
import { AiHandoffSheet } from "../components/AiHandoffSheet";
import { FoodLookupSheet } from "../components/FoodLookupSheet";
import { linesFromAiComponents, sumLines } from "../lib/foodCalc";
import {
  deleteFoodEntry,
  duplicateFoodEntry,
  getFoodEntry,
  listPhotosFor,
  listTemplates,
  markTemplateUsed,
  saveFoodEntry,
  saveTemplateFromEntry,
  type FoodEntryInput,
  type NewPhoto,
} from "../db/repo/food";
import { attachAnalyses } from "../db/repo/ai";
import { MEAL_TYPES, PORTION_UNITS, type AiFoodResult, type FoodItemLine, type FoodPhoto, type MealType, type PortionUnit } from "../db/types";
import { fromDateTimeInput, isoForLocalDate, toDateTimeInput, todayLocal } from "../lib/date";
import { processPhoto } from "../lib/image";
import { defaultMealForNow, MEAL_LABEL } from "../lib/labels";
import { fmtInt } from "../lib/format";
import { useGoBack, useLiveQuery } from "../hooks";

type FormState = {
  mealType: MealType;
  name: string;
  description: string;
  portionValue?: number;
  portionUnit: PortionUnit;
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  consumedAt: string;
  notes: string;
  source: "manual" | "ai_estimate";
  verification: "draft" | "confirmed" | "corrected";
};

type PendingPhoto = NewPhoto & { key: string };

export default function FoodEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useToast();
  const isNew = !id;
  const date = params.get("d") ?? todayLocal();

  const [form, setForm] = useState<FormState>(() => ({
    mealType: (params.get("meal") as MealType) || defaultMealForNow(),
    name: "",
    description: "",
    portionUnit: "porsi",
    consumedAt: isoForLocalDate(date),
    notes: "",
    source: "manual",
    verification: "confirmed",
  }));
  const [loaded, setLoaded] = useState(isNew);
  const [existingPhotos, setExistingPhotos] = useState<FoodPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([]);
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [templateId, setTemplateId] = useState<string>();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiResult, setAiResult] = useState<AiFoodResult>();
  const [analysisIds, setAnalysisIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<FoodItemLine[]>([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const templates = useLiveQuery(listTemplates);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addFiles = async (files: FileList | File[] | null, opts: { analyze?: boolean } = {}) => {
    if (!files?.length) return;
    const firstShot = newPhotos.length + existingPhotos.filter((p) => !removedPhotoIds.includes(p.id)).length === 0;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const p = await processPhoto(file);
        setNewPhotos((cur) => [...cur, { ...p, sizeBytes: p.blob.size + p.thumb.size, key: crypto.randomUUID() }]);
      }
      if (opts.analyze ?? firstShot) setAiOpen(true);
    } catch {
      toast("Foto tidak bisa diproses");
    } finally {
      setBusy(false);
    }
  };

  // Load existing entry, or prefill from template / history copy / photo passed from Home.
  useEffect(() => {
    (async () => {
      if (id) {
        const e = await getFoodEntry(id);
        if (!e) return navigate("/food", { replace: true });
        setForm({
          mealType: e.mealType,
          name: e.name,
          description: e.description ?? "",
          portionValue: e.portionValue,
          portionUnit: e.portionUnit ?? "porsi",
          caloriesKcal: e.caloriesKcal,
          proteinG: e.proteinG,
          carbsG: e.carbsG,
          fatG: e.fatG,
          consumedAt: e.consumedAt,
          notes: e.notes ?? "",
          source: e.source,
          verification: e.verification,
        });
        setItems(e.items ?? []);
        setExistingPhotos(await listPhotosFor(id));
        setLoaded(true);
        return;
      }
      const from = params.get("from");
      const template = params.get("template");
      if (from) {
        const e = await getFoodEntry(from);
        if (e) {
          applyValues(e);
          setItems(e.items ?? []);
        }
      } else if (template) {
        const t = (await listTemplates()).find((x) => x.id === template);
        if (t) {
          applyValues(t);
          setTemplateId(t.id);
        }
      }
      const passed = (location.state as { file?: File } | null)?.file;
      if (passed) {
        await addFiles([passed], { analyze: true });
        navigate(location.pathname + location.search, { replace: true, state: {} });
      }
    })();
  }, [id]);

  function applyValues(v: {
    name: string;
    mealType?: MealType;
    portionValue?: number;
    portionUnit?: PortionUnit;
    caloriesKcal?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    notes?: string;
  }) {
    setForm((f) => ({
      ...f,
      name: v.name,
      mealType: params.get("meal") ? f.mealType : (v.mealType ?? f.mealType),
      portionValue: v.portionValue,
      portionUnit: v.portionUnit ?? f.portionUnit,
      caloriesKcal: v.caloriesKcal,
      proteinG: v.proteinG,
      carbsG: v.carbsG,
      fatG: v.fatG,
      notes: v.notes ?? "",
      source: "manual",
      verification: "confirmed",
    }));
  }

  const firstPhoto = newPhotos[0]?.blob ?? existingPhotos.find((p) => p.blob)?.blob ?? undefined;
  const macroKcal = useMemo(
    () => (form.proteinG ?? 0) * 4 + (form.carbsG ?? 0) * 4 + (form.fatG ?? 0) * 9,
    [form.proteinG, form.carbsG, form.fatG],
  );
  const kcalMismatch =
    form.caloriesKcal != null && macroKcal > 0 && Math.abs(macroKcal - form.caloriesKcal) / form.caloriesKcal > 0.2;

  const applyAi = (r: AiFoodResult, analysisId: string) => {
    setAiResult(r);
    const lines = r.components?.length ? linesFromAiComponents(r.components) : [];
    setItems(lines);
    setAnalysisIds((ids) => [...ids, analysisId]);
    setForm((f) => ({
      ...f,
      name: f.name || r.food_name,
      description: lines.length
        ? lines.map((l) => `${l.name} (${l.serving ?? `${l.grams} g`})`).join(", ")
        : f.description,
      caloriesKcal: Math.round(r.calories_kcal),
      proteinG: Math.round(r.protein_g),
      carbsG: Math.round(r.carbs_g),
      fatG: Math.round(r.fat_g),
      notes: [f.notes, r.portion_assumption && `Asumsi AI: ${r.portion_assumption}`].filter(Boolean).join("\n"),
      source: "ai_estimate",
      verification: "draft",
    }));
    setAiOpen(false);
  };

  const applyPlate = (lines: FoodItemLine[]) => {
    const t = sumLines(lines);
    const single = lines.length === 1 ? lines[0] : undefined;
    setItems(lines);
    setAiResult(undefined);
    setForm((f) => ({
      ...f,
      name: f.name.trim() && items.length === 0 ? f.name : plateName(lines),
      description: lines.map((l) => `${l.name} (${l.serving ?? `${l.grams} g`})`).join(", "),
      portionValue: single ? single.grams : 1,
      portionUnit: single ? "g" : "porsi",
      caloriesKcal: t.caloriesKcal,
      proteinG: Math.round(t.proteinG),
      carbsG: Math.round(t.carbsG),
      fatG: Math.round(t.fatG),
      source: "manual",
      verification: "confirmed",
    }));
    setLookupOpen(false);
  };

  const save = async (verificationOverride?: FormState["verification"]) => {
    if (!form.name.trim()) {
      toast("Nama makanan wajib diisi");
      return;
    }
    setBusy(true);
    let verification = verificationOverride ?? form.verification;
    if (verification === "confirmed" && form.source === "ai_estimate" && aiResult) {
      const changed =
        Math.round(aiResult.calories_kcal) !== form.caloriesKcal ||
        Math.round(aiResult.protein_g) !== form.proteinG ||
        Math.round(aiResult.carbs_g) !== form.carbsG ||
        Math.round(aiResult.fat_g) !== form.fatG;
      if (changed) verification = "corrected";
    }
    const input: FoodEntryInput = {
      consumedAt: form.consumedAt,
      mealType: form.mealType,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      portionValue: form.portionValue,
      portionUnit: form.portionValue != null ? form.portionUnit : undefined,
      caloriesKcal: form.caloriesKcal,
      proteinG: form.proteinG,
      carbsG: form.carbsG,
      fatG: form.fatG,
      source: form.source,
      verification,
      notes: form.notes.trim() || undefined,
      templateId,
      items: items.length ? items : undefined,
    };
    try {
      const entryId = await saveFoodEntry(input, { id, newPhotos, removedPhotoIds });
      await attachAnalyses(analysisIds, entryId, verification);
      if (saveAsFavorite) await saveTemplateFromEntry(input);
      if (templateId) await markTemplateUsed(templateId);
      toast(isNew ? "Makanan tersimpan" : "Perubahan tersimpan");
      goBack("/food");
    } catch (e) {
      toast(e instanceof DOMException && e.name === "QuotaExceededError" ? "Penyimpanan penuh — hapus foto lama" : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <Page className="pb-safe">
      <PageHeader
        back
        title={isNew ? "Tambah makanan" : "Edit makanan"}
        right={
          !isNew && (
            <>
              <button
                aria-label="Duplikat"
                className="grid size-10 place-items-center rounded-full text-ink-300 active:bg-white/5"
                onClick={async () => {
                  await duplicateFoodEntry(id!);
                  toast("Diduplikasi ke sekarang");
                  navigate("/food");
                }}
              >
                <Copy className="size-5" />
              </button>
              <button
                aria-label="Hapus"
                className="grid size-10 place-items-center rounded-full text-red-300 active:bg-white/5"
                onClick={async () => {
                  if (!confirm("Hapus entri ini beserta fotonya?")) return;
                  await deleteFoodEntry(id!);
                  toast("Entri dihapus");
                  goBack("/food");
                }}
              >
                <Trash2 className="size-5" />
              </button>
            </>
          )
        }
      />

      {/* Photos */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {existingPhotos
          .filter((p) => !removedPhotoIds.includes(p.id))
          .map((p) => (
            <PhotoTile key={p.id} blob={p.blob ?? p.thumb} onRemove={() => setRemovedPhotoIds((ids) => [...ids, p.id])} />
          ))}
        {newPhotos.map((p) => (
          <PhotoTile key={p.key} blob={p.thumb} onRemove={() => setNewPhotos((cur) => cur.filter((x) => x.key !== p.key))} />
        ))}
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-3xl border border-dashed border-lime-400/40 bg-lime-400/[0.06] text-xs font-semibold text-lime-300 active:scale-95"
        >
          <Camera className="size-6" />
          Kamera
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          className="flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-3xl border border-dashed border-white/15 text-xs font-semibold text-ink-300 active:scale-95"
        >
          <ImagePlus className="size-6" />
          Galeri
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
        <Button icon={<Search className="size-5" />} onClick={() => setLookupOpen(true)}>
          {items.length ? "Ubah piring" : "Cari kalori"}
        </Button>
        <Button
          variant={firstPhoto && form.caloriesKcal == null ? "primary" : "secondary"}
          className="border-lime-400/25"
          icon={<Sparkles className="size-5" />}
          onClick={() => setAiOpen(true)}
        >
          {firstPhoto ? "Hitung foto" : "AI"}
        </Button>
      </div>

      {items.length > 0 && (
        <Card className="mt-3 border-lime-400/20" onClick={() => setLookupOpen(true)}>
          <div className="flex items-center gap-2">
            <Badge tone="lime">{items.every((l) => l.source === "local_db") ? "Dari database" : "Komponen piring"}</Badge>
            <span className="ml-auto text-sm font-semibold tabular-nums">
              {form.source === "ai_estimate" ? `≈ ${fmtInt(sumLines(items).caloriesKcal)}` : fmtInt(sumLines(items).caloriesKcal)} kkal
            </span>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm text-ink-300">
            {items.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {l.name} <span className="text-ink-500">· {l.serving ?? `${l.grams} g`}</span>
                </span>
                <span className="tabular-nums">{fmtInt(l.caloriesKcal)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-500">Angka di bawah boleh dikoreksi bila porsi/cara masak berbeda.</p>
        </Card>
      )}

      {form.source === "ai_estimate" && (
        <Card className="mt-3 border-sky-400/20">
          <div className="flex items-center gap-2">
            <Badge tone="info">Estimasi AI</Badge>
            {aiResult?.confidence && <Badge>keyakinan {aiResult.confidence}</Badge>}
            {form.verification === "draft" && <Badge tone="warn">Draft</Badge>}
          </div>
          {aiResult?.calories_range && (
            <p className="mt-2 text-sm text-ink-300">
              Rentang: {fmtInt(aiResult.calories_range[0])}–{fmtInt(aiResult.calories_range[1])} kkal
            </p>
          )}
          {!!aiResult?.clarifying_questions?.length && (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-200/90">
              {aiResult.clarifying_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-400">Periksa dan koreksi angka di bawah, lalu konfirmasi. Estimasi foto bukan data pasti.</p>
        </Card>
      )}

      {/* Quick fill from favourites */}
      {isNew && !!templates?.length && !form.name && (
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {templates.slice(0, 10).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                applyValues(t);
                setTemplateId(t.id);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-ink-850 px-3 py-2 text-sm active:bg-ink-700"
            >
              <Star className="size-3.5 text-lime-400" />
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <Segmented
          value={form.mealType}
          onChange={(v) => set("mealType", v)}
          options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
        />

        <Field label="Nama makanan">
          <TextInput value={form.name} placeholder="mis. Nasi ayam bakar" onChange={(e) => set("name", e.target.value)} />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Porsi">
            <NumberInput value={form.portionValue} onChange={(v) => set("portionValue", v)} placeholder="1" />
          </Field>
          <Field label="Satuan">
            <Select value={form.portionUnit} onChange={(e) => set("portionUnit", e.target.value as PortionUnit)} className="w-28">
              {PORTION_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Kalori"
          hint={kcalMismatch ? `Dari makro ≈ ${fmtInt(macroKcal)} kkal — cek kembali angkanya.` : undefined}
        >
          <NumberInput value={form.caloriesKcal} onChange={(v) => set("caloriesKcal", v)} suffix="kkal" placeholder="0" />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Protein">
            <NumberInput value={form.proteinG} onChange={(v) => set("proteinG", v)} suffix="g" />
          </Field>
          <Field label="Karbo">
            <NumberInput value={form.carbsG} onChange={(v) => set("carbsG", v)} suffix="g" />
          </Field>
          <Field label="Lemak">
            <NumberInput value={form.fatG} onChange={(v) => set("fatG", v)} suffix="g" />
          </Field>
        </div>
        {form.caloriesKcal == null && macroKcal > 0 && (
          <button className="-mt-2 px-1 text-sm text-lime-400" onClick={() => set("caloriesKcal", Math.round(macroKcal))}>
            Hitung kalori dari makro ({fmtInt(macroKcal)} kkal)
          </button>
        )}

        <Field label="Waktu">
          <TextInput
            type="datetime-local"
            value={toDateTimeInput(form.consumedAt)}
            onChange={(e) => e.target.value && set("consumedAt", fromDateTimeInput(e.target.value))}
          />
        </Field>

        <Field label="Deskripsi">
          <TextInput value={form.description} placeholder="mis. setengah porsi nasi" onChange={(e) => set("description", e.target.value)} />
        </Field>

        <Field label="Catatan" hint="Cara memasak, saus/minyak, bahan tambahan.">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <Card className="py-2">
          <Toggle checked={saveAsFavorite} onChange={setSaveAsFavorite} label="Simpan sebagai favorit" hint="Agar bisa dipakai ulang dengan satu ketukan." />
        </Card>
      </div>

      <div className="mt-6 flex gap-2">
        {form.source === "ai_estimate" && (
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => save("draft")}>
            Simpan draft
          </Button>
        )}
        <Button className="flex-[2]" disabled={busy} onClick={() => save(form.source === "ai_estimate" ? "confirmed" : undefined)}>
          {form.source === "ai_estimate" ? "Konfirmasi & simpan" : "Simpan"}
        </Button>
      </div>

      <AiHandoffSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        photo={firstPhoto}
        mealType={form.mealType}
        description={[form.name, form.description].filter(Boolean).join(" — ")}
        portionHint={form.portionValue != null ? `${form.portionValue} ${form.portionUnit}` : undefined}
        onApply={applyAi}
      />

      <FoodLookupSheet open={lookupOpen} onClose={() => setLookupOpen(false)} initialItems={items} onApply={applyPlate} />
    </Page>
  );
}

function plateName(lines: FoodItemLine[]) {
  const names = lines.map((l) => l.name.replace(/\s*\(.*\)$/, ""));
  return names.length <= 3 ? names.join(" + ") : `${names.slice(0, 2).join(" + ")} + ${names.length - 2} lainnya`;
}

function PhotoTile({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  return (
    <div className="relative size-28 shrink-0">
      <BlobImage blob={blob} alt="Foto makanan" className={cx("size-28 rounded-3xl")} />
      <button
        aria-label="Hapus foto"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/70 text-white backdrop-blur"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
