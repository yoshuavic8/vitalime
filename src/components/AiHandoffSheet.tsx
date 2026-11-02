import { useEffect, useState, type ReactNode } from "react";
import { ClipboardPaste, Copy, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, BlobImage, Button, Card, Field, Notice, Sheet, TextArea, TextInput, useToast } from "./ui";
import { buildFoodPrompt, parseAiFoodResult } from "../lib/aiHandoff";
import { saveAiAnalysis } from "../db/repo/ai";
import { getSetting, setSetting, SETTING_KEYS } from "../db/repo/settings";
import type { AiFoodResult, MealType } from "../db/types";
import { fmtInt } from "../lib/format";
import { isIos } from "../lib/storage";

export function AiHandoffSheet({
  open,
  onClose,
  photo,
  mealType,
  description,
  portionHint,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  photo?: Blob;
  mealType: MealType;
  description?: string;
  portionHint?: string;
  onApply: (result: AiFoodResult, analysisId: string) => void;
}) {
  const toast = useToast();
  const [consent, setConsent] = useState<boolean>();
  const [model, setModel] = useState("Grok / Cursor (manual)");
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<AiFoodResult>();
  const [error, setError] = useState<string>();
  const prompt = buildFoodPrompt({ mealType, description, portionHint });
  const ios = isIos();

  useEffect(() => {
    if (!open) return;
    getSetting<boolean>(SETTING_KEYS.aiConsent).then((v) => setConsent(!!v));
    getSetting<string>(SETTING_KEYS.aiModelLabel).then((v) => v && setModel(v));
  }, [open]);

  const share = async () => {
    const files = photo ? [new File([photo], "makanan.jpg", { type: photo.type || "image/jpeg" })] : [];
    const data: ShareData = files.length ? { files, text: prompt } : { text: prompt };
    try {
      if (navigator.canShare?.(data)) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
    await navigator.clipboard?.writeText(prompt);
    toast("Prompt disalin. Lampirkan foto secara manual di aplikasi AI.");
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRaw(text);
      tryParse(text);
    } catch {
      toast("Tidak bisa membaca clipboard — tempel manual di kotak.");
    }
  };

  const tryParse = (text: string) => {
    setError(undefined);
    setParsed(undefined);
    if (!text.trim()) return;
    try {
      setParsed(parseAiFoodResult(text));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const apply = async () => {
    if (!parsed) return;
    await setSetting(SETTING_KEYS.aiModelLabel, model);
    const id = await saveAiAnalysis({
      channel: "manual_handoff",
      model,
      prompt,
      rawResult: raw,
      parsed,
      status: "draft",
    });
    onApply(parsed, id);
    setRaw("");
    setParsed(undefined);
  };

  if (consent !== true) {
    return (
      <Sheet open={open} onClose={onClose} title="Analisis foto makanan">
        {consent == null ? (
          <p className="text-sm text-ink-400">Memuat…</p>
        ) : (
          <>
            <div className="space-y-3 text-sm leading-relaxed text-ink-300">
              <div className="grid size-12 place-items-center rounded-2xl bg-lime-400/15 text-lime-400">
                <ShieldCheck className="size-6" />
              </div>
              <p>
                Vitalime <b className="text-ink-100">tidak mengirim foto ke AI secara otomatis</b>. Langganan Cursor tidak
                memberi API ke aplikasi di iPhone — kamu sendiri yang membagikan foto + prompt.
              </p>
              <p>
                Di iPhone: Share ke <b className="text-ink-100">Grok</b> (model yang sama). Di komputer: tempel prompt di
                chat Cursor dan lampirkan foto.
              </p>
              <p>
                Hasil selalu disimpan sebagai <b className="text-ink-100">draft</b> sampai kamu periksa dan konfirmasi.
                Foto yang dibagikan diproses oleh penyedia AI sesuai kebijakan privasinya.
              </p>
            </div>
            <Button
              block
              className="mt-5"
              onClick={async () => {
                await setSetting(SETTING_KEYS.aiConsent, true);
                setConsent(true);
              }}
            >
              Saya paham, lanjutkan
            </Button>
          </>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Hitung kalori dari foto"
      footer={
        <Button block disabled={!parsed} onClick={apply}>
          Gunakan sebagai draft
        </Button>
      }
    >
      <div className="space-y-4">
        {photo ? (
          <BlobImage blob={photo} alt="Foto makanan" className="h-40 w-full rounded-3xl object-cover" />
        ) : (
          <Notice tone="warn">Belum ada foto. Estimasi dari deskripsi saja akan kurang akurat — ambil foto piring dulu.</Notice>
        )}

        <Step n={1} title={ios ? "Bagikan ke Grok" : "Kirim ke Cursor atau Grok"}>
          <p className="text-sm text-ink-400">
            {ios
              ? "Pilih Grok di Share Sheet (bukan Safari). Prompt ikut terkirim bersama foto."
              : "Tempel prompt di chat Cursor, lampirkan foto, lalu salin JSON yang dikembalikan."}
          </p>
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" icon={<Share2 className="size-4" />} onClick={share}>
              {photo ? "Share foto + prompt" : "Share prompt"}
            </Button>
            <Button
              variant="secondary"
              icon={<Copy className="size-4" />}
              onClick={async () => {
                await navigator.clipboard?.writeText(prompt);
                toast("Prompt disalin");
              }}
            >
              Salin
            </Button>
          </div>
          <details className="mt-2 text-xs text-ink-400">
            <summary className="cursor-pointer">Lihat prompt</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed">{prompt}</pre>
          </details>
        </Step>

        <Step n={2} title="Tempel jawaban JSON">
          <TextArea
            rows={5}
            placeholder='{"food_name": "...", "calories_kcal": ...}'
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              tryParse(e.target.value);
            }}
            className="font-mono text-[13px]"
          />
          <Button variant="ghost" size="sm" className="mt-1" icon={<ClipboardPaste className="size-4" />} onClick={paste}>
            Tempel dari clipboard
          </Button>
          {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
        </Step>

        <Field label="Model / aplikasi" hint="Disimpan bersama prompt untuk catatan audit pribadi.">
          <TextInput value={model} onChange={(e) => setModel(e.target.value)} />
        </Field>

        {parsed && (
          <Card className="border-lime-400/25">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-lime-400" />
              <span className="font-semibold">{parsed.food_name}</span>
              {parsed.confidence && <Badge tone={parsed.confidence === "high" ? "lime" : "warn"}>{parsed.confidence}</Badge>}
            </div>
            <div className="mt-2 font-display text-2xl font-bold">
              {fmtInt(parsed.calories_kcal)} <span className="text-sm text-ink-400">kkal</span>
              {parsed.calories_range && (
                <span className="ml-2 text-sm font-normal text-ink-400">
                  ({fmtInt(parsed.calories_range[0])}–{fmtInt(parsed.calories_range[1])})
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-ink-300">
              P {fmtInt(parsed.protein_g)} g · K {fmtInt(parsed.carbs_g)} g · L {fmtInt(parsed.fat_g)} g
            </div>
            {!!parsed.components?.length && (
              <ul className="mt-3 space-y-1 text-sm text-ink-300">
                {parsed.components.map((c) => (
                  <li key={c.name} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {c.name}
                      {c.estimated_portion && <span className="text-ink-500"> · {c.estimated_portion}</span>}
                    </span>
                    {c.calories_kcal != null && <span className="tabular-nums text-ink-400">{fmtInt(c.calories_kcal)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {parsed.portion_assumption && <p className="mt-2 text-xs text-ink-400">Asumsi: {parsed.portion_assumption}</p>}
            {!!parsed.clarifying_questions?.length && (
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-200/90">
                {parsed.clarifying_questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </Sheet>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-lime-400 text-xs font-bold text-ink-950">{n}</span>
        <span className="font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}
