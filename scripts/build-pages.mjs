import { cp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const version = process.env.GITHUB_SHA || 'local-preview';

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : entry.isFile() ? [file] : [];
  }));
  return nested.flat();
}

function versionHtmlResources(html, htmlFile, publicFiles) {
  function resourceUrl(value) {
    const url = value.trim().replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    // Keep external URLs, inline data, page anchors and empty links unchanged.
    if (!url || /^(?:#|\/\/|[a-z][a-z\d+.-]*:)/i.test(url)) return null;
    const hashAt = url.indexOf('#');
    const fragment = hashAt < 0 ? '' : url.slice(hashAt);
    const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
    const queryAt = beforeHash.indexOf('?');
    const pathname = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
    if (!pathname) return null;
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return null; }
    if (decoded.includes('\\') || decoded.includes('\0')) return null;
    const file = decoded.startsWith('/')
      ? resolve(output, '.' + decoded)
      : resolve(dirname(htmlFile), decoded);
    // The copied public inventory is also the boundary: never version backend paths.
    if (!publicFiles.has(file)) return null;
    const query = new URLSearchParams(queryAt < 0 ? '' : beforeHash.slice(queryAt + 1));
    query.set('v', version);
    return (pathname + '?' + query.toString() + fragment).replace(/&/g, '&amp;');
  }

  function rewriteTag(tag) {
    return tag.replace(/(\s)(src|href)(\s*=\s*)(?:(["'])([\s\S]*?)\4|([^\s"'=<>`]+))/gi,
      (whole, space, attribute, equals, quote, quoted, unquoted) => {
        const value = resourceUrl(quoted ?? unquoted);
        if (value === null) return whole;
        const delimiter = quote || '"';
        return space + attribute + equals + delimiter + value + delimiter;
      });
  }

  // Only edit real tags. Keep comments and script/style bodies byte-for-byte intact.
  const tags = /<!--[\s\S]*?-->|<(script|style)\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/\1\s*>|<(?:"[^"]*"|'[^']*'|[^'">])*?>/gi;
  return html.replace(tags, token => {
    if (token.startsWith('<!--')) return token;
    if (/^<(?:script|style)\b/i.test(token)) {
      const opening = token.match(/^<(?:"[^"]*"|'[^']*'|[^'">])*?>/)[0];
      return rewriteTag(opening) + token.slice(opening.length);
    }
    return rewriteTag(token);
  });
}

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
const publicFiles = new Set(await listFiles(output));
for (const file of publicFiles) {
  if (!file.toLowerCase().endsWith('.html')) continue;
  const html = await readFile(file, 'utf8');
  await writeFile(file, versionHtmlResources(html, file, publicFiles), 'utf8');
}
await writeFile(resolve(output, '.nojekyll'), '');
await writeFile(resolve(output, 'release.json'), JSON.stringify({
  commit: version,
  builtAt: new Date().toISOString()
}, null, 2) + '\n');
console.log(`Public site prepared in ${output}`);
