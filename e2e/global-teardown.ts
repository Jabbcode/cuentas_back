import { execSync } from 'node:child_process';

export default function globalTeardown(): void {
  execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' });
}
