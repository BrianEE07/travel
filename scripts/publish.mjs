import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('npm', ['run', 'sync:previews']);
run('npm', ['run', 'test']);
run('npm', ['run', 'check']);
run('npx', ['astro', 'build']);
run('node', ['scripts/scan-dist.mjs']);
if (!fs.existsSync(path.join(root, '.git'))) {
  console.log('Build is safe and ready. Initialize the Git repository before the first publish.');
  process.exit(0);
}
run('git', ['add', 'src/data/trips']);
const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root });
if (diff.status === 0) {
  console.log('No public itinerary changes to publish.');
  process.exit(0);
}
const stamp = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(new Date());
run('git', ['commit', '-m', `Update public itinerary ${stamp}`]);
run('git', ['push', 'origin', 'main']);
