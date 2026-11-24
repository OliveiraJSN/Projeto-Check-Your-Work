import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // exigido pelo matcher toPassAsync() do ArchUnitTS
    include: ['test/**/*.spec.ts'],
  },
});
