import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies /api -> FastAPI so no CORS setup is needed on the backend
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", rewrite: (p) => p.replace(/^\/api/, "") },
    },
  },
});
