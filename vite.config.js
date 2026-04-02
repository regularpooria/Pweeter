import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true, // Allows ngrok and other hostnames to connect
  },
});
