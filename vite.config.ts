import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/@react-three/')) return 'react-three';
          if (id.includes('/node_modules/react/')) return 'react';
        },
      },
      input: {
        home: resolve(projectRoot, 'index.html'),
        about: resolve(projectRoot, 'about.html'),
        timeline: resolve(projectRoot, 'timeline.html'),
      },
    },
  },
});
