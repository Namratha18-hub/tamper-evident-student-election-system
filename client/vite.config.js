import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api requests are forwarded to the Express server, so session cookies work without CORS setup.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:5000" } },
});
