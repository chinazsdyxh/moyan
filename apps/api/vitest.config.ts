import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'dist/**',
        'src/server.ts',
        'src/providers/huaweicloud-provider.ts'
      ]
    }
  }
});
