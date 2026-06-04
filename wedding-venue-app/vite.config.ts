import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Build-mode selection ─────────────────────────────────────────────────────
//
//  npm run build        → single-file  (DEFAULT)
//    All JS/CSS inlined into one index.html.
//    Works when opened directly from the filesystem (file://) with no server.
//    React.lazy() chunks are collapsed by inlineDynamicImports — no network
//    requests needed at runtime.
//
//  npm run build:split  → chunked / code-split  (server deployments)
//    Produces separate .js chunks in dist/assets/.
//    React.lazy() boundaries load on demand — faster first paint on a CDN.
//    Requires a web server (Netlify, Vercel, nginx, `npm run preview`, etc.)
//    because dynamic import() is blocked by browsers on the file:// protocol.
//
const useSplit = process.env.VITE_SPLIT === "1";

export default defineConfig({
  // ── Vitest (tests always run in jsdom regardless of build mode) ────────────
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
  },

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: [
    react(),
    tailwindcss(),
    // Single-file plugin active in default build mode only.
    ...(useSplit ? [] : [viteSingleFile()]),
  ],

  // Relative asset paths so the file works from any directory.
  base: "./",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ── Build options ─────────────────────────────────────────────────────────
  build: useSplit
    ? {
        // ── Chunked / code-split (npm run build:split) ─────────────────────
        rollupOptions: {
          output: {
            chunkFileNames: "assets/[name]-[hash].js",
            entryFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash][extname]",
            manualChunks: {
              "vendor-react": ["react", "react-dom"],
              "vendor-supabase": ["@supabase/supabase-js"],
              "vendor-yjs": ["yjs", "y-websocket"],
              "chunk-admin": [
                "./src/components/AdminPanel",
                "./src/components/AdminDecorSection",
              ],
              "chunk-decor": ["./src/components/DecorDesigner"],
              "chunk-guest-portal": ["./src/components/GuestPortal"],
            },
          },
        },
      }
    : {
        // ── Single-file (npm run build — DEFAULT) ──────────────────────────
        // Everything inlined → one self-contained index.html, no server needed.
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            // Collapses all dynamic import() calls so the single-file plugin
            // can bundle everything into index.html.
            inlineDynamicImports: true,
          },
        },
      },
});
