import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_EXCLUDE = ['e2e/**', 'node_modules/**', '.next/**'];
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  resolve: {
    alias: {
      '@': ROOT_DIR,
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/bytedance-afr-provider.spec.ts'],
          exclude: BASE_EXCLUDE,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/**/*.spec.{ts,tsx}'],
          exclude: [...BASE_EXCLUDE, 'tests/bytedance-afr-provider.spec.ts'],
        },
      },
    ],
  },
});
