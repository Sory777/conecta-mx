import { defineConfig } from 'vitest/config';

// Runs against a live API: `npm run dev:api` (AI_PROVIDER=mock) then `npm run test:integration`.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
