import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// Load .env before evaluating config so TEST_DATABASE_URL is available below
dotenv.config();

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

