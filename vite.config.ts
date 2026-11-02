import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// BASE_PATH lets the same build run at a domain root (Cloudflare/Netlify/Vercel)
// or under a sub-path such as GitHub Pages (`/vitalime/`).
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/*.png", "splash/*.png"],
      manifest: {
        id: base,
        name: "Vitalime — Personal Health",
        short_name: "Vitalime",
        description:
          "Jurnal kesehatan pribadi offline-first: makanan, aktivitas, latihan beban, dan progres tubuh.",
        lang: "id",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#050505",
        theme_color: "#050505",
        categories: ["health", "fitness", "lifestyle"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Health data never leaves the device through the SW: no runtime caching of remote APIs.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
});
