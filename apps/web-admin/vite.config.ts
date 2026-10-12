import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Port 5173 : c'est l'un des ports de développement autorisés par la CORS du backend
// (apps/backend/src/main.ts). strictPort : si 5173 est pris, Vite s'arrête au lieu de
// glisser vers un port que le backend refuserait.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: { sourcemap: false },
});