import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { reviewNotes } from './vite.review-plugin';
import { pgLayouts } from './vite.layouts-plugin';

export default defineConfig({
  // Relative asset paths — this build gets uploaded to arbitrary subpaths
  // (e.g. stovba.com/sga-calc22), not always served from a domain root, so
  // absolute "/assets/..." references would 404 there.
  base: './',
  plugins: [react(), tailwindcss(), pgLayouts(), reviewNotes()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5174
  }
});
