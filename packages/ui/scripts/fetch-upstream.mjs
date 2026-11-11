#!/usr/bin/env node
// Shallow-clones (or updates) GNOME/libadwaita under src/design-system.
//   node scripts/fetch-upstream.mjs [ref]      e.g. main, libadwaita-1-7
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ref = process.argv[2] ?? 'main';
const packageRoot = path.resolve(import.meta.dirname, '..');
const dir = path.join(packageRoot, 'src', 'design-system', 'upstream');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { stdio: 'inherit', cwd });

if (fs.existsSync(dir)) {
    run('git', ['fetch', '--depth', '1', 'origin', ref], dir);
    run('git', ['checkout', '--force', 'FETCH_HEAD'], dir);
} else {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    run('git', ['clone', '--depth', '1', '--branch', ref, 'https://github.com/GNOME/libadwaita.git', dir]);
}
