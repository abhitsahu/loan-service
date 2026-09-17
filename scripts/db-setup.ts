#!/usr/bin/env tsx
/**
 * npm run db:setup
 * Runs `prisma migrate deploy` then seeds the database.
 * Safe to re-run — migrations are idempotent; seed checks for existing data.
 */
import { execSync } from 'child_process';

function run(cmd: string) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

run('npx prisma migrate deploy');
run('npx prisma db seed');
console.log('\n✅  Database is ready.');
