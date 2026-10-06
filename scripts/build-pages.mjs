import { cp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
// Refuse redirected build directories before cleaning the fixed artifact path.
const existingOutput = await realpath(output).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (dirname(output) !== root || (existingOutput && existingOutput !== output)) {
  throw new Error('Refusing to clean a build directory outside this repository');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Explicit public allowlist: server-side code, credentials, tests and reports
// never enter the GitHub Pages artifact.
await cp(resolve(root, 'index.html'), resolve(output, 'index.html'));
await cp(resolve(root, 'assets'), resolve(output, 'assets'), { recursive: true });
await writeFile(resolve(output, '.nojekyll'), '');
await writeFile(resolve(output, 'release.json'), JSON.stringify({
  commit: process.env.GITHUB_SHA || 'local-preview',
  builtAt: new Date().toISOString()
}, null, 2) + '\n');
console.log(`Public site prepared in ${output}`);
