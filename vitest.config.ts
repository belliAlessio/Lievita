import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest and Date use the same explicit local zone in deterministic DST tests.
process.env.TZ = 'Europe/Rome';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
