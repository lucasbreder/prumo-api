import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
export default async function globalSetup(): Promise<void> {
  // Aponta o DATABASE_URL for o banco of teste e aplica the migrations.
  const envPath = '.env';
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    const testUrl = /^DATABASE_URL_TEST="?([^"\n]+)"?$/m.exec(content)?.[1];
    if (!testUrl) throw new Error('DATABASE_URL_TEST ausente no .env');
    process.env.DATABASE_URL = testUrl;
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });
}
