import { defineConfig } from "@tanstack/start/config"

export default defineConfig({
  server: {
    preset: "static"
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000
    }
  }
})