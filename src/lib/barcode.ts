// Decodes product barcodes from a photo. iOS Safari has no native BarcodeDetector, so this uses the
// ZXing WebAssembly ponyfill; the .wasm is bundled with the app instead of loaded from a CDN.
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? zxingWasmUrl : prefix + path),
  },
});

let detector: BarcodeDetector | undefined;

export async function decodeBarcode(image: Blob): Promise<string | undefined> {
  detector ??= new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  const results = await detector.detect(image);
  return results.find((r) => r.rawValue)?.rawValue;
}
