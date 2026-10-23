import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The app is static. The service worker precaches the app shell, the fonts and
// every file in public/data, so the starter set works with the network off.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "Chemsisy",
        short_name: "Chemsisy",
        description: "Open-source molecule explorer for pharmacy and medical students.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f7f8f8",
        theme_color: "#f7f8f8",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png}", "data/**/*.json"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: false,
    // The 3D viewer is one lazily loaded chunk of about 160 kB gzipped; that is expected.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/3dmol")) return "viewer";
        },
      },
    },
  },
});
