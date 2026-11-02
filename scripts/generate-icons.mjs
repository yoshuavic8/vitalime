// Renders the Vitalime icon set + iOS splash screens from SVG sources.
// Run: npm run icons
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const LIME = "#C6FF3D";
const LIME_DEEP = "#8BE000";
const LEAF = "M286 742 C 270 470 452 286 770 258 C 772 560 594 748 286 742 Z";

// Mark drawn on a 1024 canvas, centred inside the 80% maskable safe zone.
const mark = `
  <g>
    <path d="M300 736 L 236 800" stroke="${LIME_DEEP}" stroke-width="42" stroke-linecap="round"/>
    <path d="${LEAF}" fill="url(#leaf)"/>
    <path d="M206 560 H 402 L 452 470 L 530 650 L 590 512 L 626 560 H 820"
          fill="none" stroke="#050505" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"
          clip-path="url(#leafClip)"/>
  </g>`;

const defs = `
  <defs>
    <clipPath id="leafClip"><path d="${LEAF}"/></clipPath>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#1A2108"/>
      <stop offset="0.55" stop-color="#0B0D06"/>
      <stop offset="1" stop-color="#050505"/>
    </radialGradient>
    <linearGradient id="leaf" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${LIME_DEEP}"/>
      <stop offset="1" stop-color="${LIME}"/>
    </linearGradient>
  </defs>`;

const iconSvg = (scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${mark}</g>
</svg>`;

const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${defs}
  <rect width="1024" height="1024" rx="230" fill="url(#bg)"/>
  ${mark}
</svg>`;

const splashSvg = (w, h) => {
  const size = Math.round(w * 0.34);
  const x = (w - size) / 2;
  const y = h / 2 - size * 0.75;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defs}
  <rect width="${w}" height="${h}" fill="#050505"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="230" fill="url(#bg)"/>
    ${mark}
  </svg>
  <text x="50%" y="${y + size + w * 0.12}" text-anchor="middle" fill="#F4F4F5"
        font-family="-apple-system, Helvetica, Arial, sans-serif" font-weight="700"
        font-size="${Math.round(w * 0.075)}" letter-spacing="2">Vitalime</text>
  <text x="50%" y="${y + size + w * 0.18}" text-anchor="middle" fill="${LIME}"
        font-family="-apple-system, Helvetica, Arial, sans-serif" font-weight="500"
        font-size="${Math.round(w * 0.032)}" letter-spacing="6">PERSONAL HEALTH</text>
</svg>`;
};

const render = (svg, size, out) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);

await mkdir("public/icons", { recursive: true });
await mkdir("public/splash", { recursive: true });

await writeFile("public/favicon.svg", faviconSvg.trim());
await render(iconSvg(1), 180, "public/icons/apple-touch-icon.png");
await render(iconSvg(1), 192, "public/icons/icon-192.png");
await render(iconSvg(1), 512, "public/icons/icon-512.png");
await render(iconSvg(0.82), 512, "public/icons/maskable-512.png");
await render(iconSvg(1), 1024, "public/icons/icon-1024.png");

for (const [w, h] of [
  [1170, 2532],
  [1179, 2556],
  [1284, 2778],
  [1290, 2796],
]) {
  await sharp(Buffer.from(splashSvg(w, h))).png().toFile(`public/splash/splash-${w}x${h}.png`);
}

console.log("Icons and splash screens generated.");
