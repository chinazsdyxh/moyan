import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['dist/**', 'src/main.tsx', 'src/vite-env.d.ts']
    }
  }
});
