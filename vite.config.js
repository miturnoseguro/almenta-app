import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Todo lo que necesitás tocar (nombre, colores, ícono) ya está seteado
// para que coincida con la identidad de almenta. Si cambiás el logo,
// regenerá los íconos en /public/icons con el mismo nombre de archivo.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "almenta — nutrición con acompañamiento",
        short_name: "almenta",
        description:
          "Tu plan de alimentación a medida, con seguimiento diario y una coach real.",
        theme_color: "#6E4359",
        background_color: "#F7F1E6",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cachea el shell de la app para que abra offline / instalada en Android.
        globPatterns: ["**/*.{js,css,html,png,svg,jpg,jpeg}"],
        runtimeCaching: [
          {
            // Las fuentes de Google se cachean aparte, no bloquean el shell.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // permite probar el service worker en `npm run dev`
      },
    }),
  ],
});
