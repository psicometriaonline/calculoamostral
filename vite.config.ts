import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client/public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/app/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "client/index.html"),
        calculadora: path.resolve(__dirname, "client/calculadora.html"),
        privacidade: path.resolve(__dirname, "client/privacidade.html"),
        termos: path.resolve(__dirname, "client/termos.html"),
        "404": path.resolve(__dirname, "client/404.html"),
      },
    },
  },
  server: { proxy: { "/api": "http://localhost:3000" } },
});
