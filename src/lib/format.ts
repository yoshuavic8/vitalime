const intFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function fmtInt(n: number | undefined | null): string {
  return n == null || Number.isNaN(n) ? "—" : intFmt.format(n);
}

export function fmt1(n: number | undefined | null): string {
  return n == null || Number.isNaN(n) ? "—" : oneFmt.format(n);
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${oneFmt.format(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${oneFmt.format(bytes / 1024 ** 2)} MB`;
  return `${oneFmt.format(bytes / 1024 ** 3)} GB`;
}

export function fmtDuration(minutes: number | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} j ${m} m` : `${m} m`;
}

/** Parse user/import numeric input, accepting comma decimals and trailing units ("1.234 kcal"). */
export function parseNum(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/\s/g, "");
  if (!cleaned) return undefined;
  const match = cleaned.match(/-?[\d.,]+/);
  if (!match) return undefined;
  let num = match[0];
  // "1.234,5" (id-ID) vs "1,234.5" (en-US) vs "72,5"
  if (num.includes(",") && num.includes(".")) {
    num = num.lastIndexOf(",") > num.lastIndexOf(".")
      ? num.replace(/\./g, "").replace(",", ".")
      : num.replace(/,/g, "");
  } else if (num.includes(",")) {
    num = num.replace(",", ".");
  }
  const n = Number(num);
  return Number.isFinite(n) ? n : undefined;
}

export function sum(values: (number | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
