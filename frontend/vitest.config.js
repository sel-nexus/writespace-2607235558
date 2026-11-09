/** Run colocated discovery tests in an isolated browser-like environment. */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    restoreMocks: true,
    coverage: { provider: 'v8', include: ['src/**/*.{js,jsx}'], exclude: ['src/test/**', 'src/**/*.test.*', 'src/main.jsx'] },
  },
});
