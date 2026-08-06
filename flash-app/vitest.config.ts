import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Standalone from vite.config.ts on purpose: that config loads the platform's
// asap build-contract plugins, which expect a real build and would fail under tests.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
