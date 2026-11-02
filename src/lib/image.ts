export type ProcessedImage = {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: string;
};

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to <img> decoding (older Safari, HEIC edge cases).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal mengompres foto"))), "image/jpeg", quality),
  );
}

async function resize(source: ImageBitmap | HTMLImageElement, maxSide: number, quality: number) {
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, quality);
  return { blob, width: canvas.width, height: canvas.height };
}

/** Compress a camera photo to a storage-friendly JPEG plus a small list thumbnail. */
export async function processPhoto(file: Blob): Promise<ProcessedImage> {
  const bitmap = await loadBitmap(file);
  const full = await resize(bitmap, 1600, 0.82);
  const thumb = await resize(bitmap, 360, 0.72);
  if ("close" in bitmap) bitmap.close();
  return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height, mime: "image/jpeg" };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
