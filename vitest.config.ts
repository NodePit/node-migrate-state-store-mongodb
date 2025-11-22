import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './vitest.global-setup.ts',
    setupFiles: './vitest.setup.ts',
    pool: 'threads',
    coverage: {
      provider: 'v8'
    },
    reporters: ['default', 'junit']
  }
});
