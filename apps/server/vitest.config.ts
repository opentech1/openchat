import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    include: ['convex/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/_generated/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../web/src'),
      '@server': path.resolve(__dirname, '.'),
    },
  },
});
