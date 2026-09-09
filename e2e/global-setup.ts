import { execSync } from 'node:child_process';

export default function globalSetup(): void {
  execSync('docker compose -f docker-compose.test.yml up -d --wait', { stdio: 'inherit' });
  execSync('npm run db:migrate:test', { stdio: 'inherit' });
}
