import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? `local-${Date.now()}`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "emit-build-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ version: buildVersion })
        });
      }
    }
  ],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(buildVersion)
  },
  envDir: "..",
  server: {
    port: 5173
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          realtime: ["socket.io-client"],
          icons: ["lucide-react"]
        }
      }
    }
  }
});
