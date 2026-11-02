// Open Food Facts: free, open, crowd-sourced database of packaged foods. Called directly from the
// browser (CORS-enabled, no key). Only the search text or barcode is sent — never photos or logs.
import type { Per100 } from "./foodCalc";

export type OffProduct = {
  code: string;
  name: string;
  brand?: string;
  /** Per 100 g, or per 100 ml for drinks. */
  per100: Per100;
  /** Grams per serving as declared on the label, when available. */
  servingGrams?: number;
  servingLabel?: string;
  imageUrl?: string;
};

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_id,product_name_en,brands,nutriments,serving_size,serving_quantity,image_front_small_url";

type RawProduct = {
  code?: string;
  product_name?: string;
  product_name_id?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  image_front_small_url?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

export function parseOffProduct(raw: RawProduct): OffProduct | undefined {
  const n = raw.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) != null ? num(n["energy_100g"])! / 4.184 : undefined);
  const name = raw.product_name_id || raw.product_name || raw.product_name_en;
  if (!raw.code || !name || kcal == null) return undefined;
  const servingGrams = num(raw.serving_quantity);
  return {
    code: raw.code,
    name: name.trim(),
    brand: raw.brands?.split(",")[0]?.trim() || undefined,
    per100: {
      kcal: Math.round(kcal),
      protein: num(n["proteins_100g"]) ?? 0,
      carbs: num(n["carbohydrates_100g"]) ?? 0,
      fat: num(n["fat_100g"]) ?? 0,
    },
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
    servingLabel: raw.serving_size || undefined,
    imageUrl: raw.image_front_small_url,
  };
}

async function getJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  return res.json();
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<OffProduct | undefined> {
  const clean = code.replace(/\D/g, "");
  if (!clean) return undefined;
  const data = await getJson(`${BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`, signal);
  if (data?.status !== 1 || !data.product) return undefined;
  return parseOffProduct({ ...data.product, code: data.product.code ?? clean });
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<OffProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "24",
    fields: FIELDS,
  });
  const data = await getJson(`${BASE}/cgi/search.pl?${params}`, signal);
  return ((data?.products ?? []) as RawProduct[]).map(parseOffProduct).filter((p): p is OffProduct => !!p);
}
