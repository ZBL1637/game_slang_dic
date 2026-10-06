import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const exec = promisify(execFile);
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildSource = await readFile(join(project, 'scripts/build-pages.mjs'), 'utf8');
const releaseA = 'a'.repeat(40), releaseB = 'b'.repeat(40);

async function fixture(t, files = {}) {
  const temporary = await realpath(tmpdir());
  const root = await mkdtemp(join(temporary, 'gameslang-pages-test-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), temporary);
    assert.ok(basename(root).startsWith('gameslang-pages-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, content) => {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), content);
  };
  await put('scripts/build-pages.mjs', buildSource);
  await mkdir(join(root, 'assets'), { recursive: true });
  await put('index.html', '<!doctype html><html><body>Fixture</body></html>');
  for (const [name, content] of Object.entries(files)) await put(name, content);
  return {
    root, put,
    read: name => readFile(join(root, name), 'utf8'),
    async build(version = releaseA) {
      const env = { ...process.env };
      if (version === null) delete env.GITHUB_SHA; else env.GITHUB_SHA = version;
      return exec(process.execPath, [join(root, 'scripts/build-pages.mjs')], { cwd: root, env });
    }
  };
}

const decode = value => value.replace(/&amp;/g, '&');
const urlFrom = (value, base = 'https://example.github.io/game_slang_dic/') => new URL(decode(value), base);
const attr = (html, attribute) => [...html.matchAll(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'gi'))].map(match => match[2]);

test('build retains the public allowlist and removes old artifact canaries without touching sources', async t => {
  const sourceHtml = '<script src="assets/app.js"></script>';
  const f = await fixture(t, {
    'index.html': sourceHtml,
    'assets/app.js': 'window.app = true;',
    'assets/vendor/LICENSE': 'fixture license',
    'backend/worker.js': 'private backend fixture',
    '.env': 'fixture credential configuration',
    'tests/private.test.mjs': 'test fixture',
    'reports/private.log': 'report fixture',
    'dist/old-canary.txt': 'stale root file',
    'dist/assets/old-canary.js': 'stale public file',
    'dist/backend/leaked.txt': 'stale backend fixture'
  });
  await f.build();
  for (const name of ['old-canary.txt', 'assets/old-canary.js', 'backend', 'tests', 'reports', '.env', 'scripts']) {
    await assert.rejects(stat(join(f.root, 'dist', name)), { code: 'ENOENT' });
  }
  assert.equal(await f.read('index.html'), sourceHtml);
  assert.equal(await f.read('assets/app.js'), 'window.app = true;');
  assert.equal(await f.read('dist/assets/app.js'), 'window.app = true;');
  assert.equal(await f.read('dist/assets/vendor/LICENSE'), 'fixture license');
  assert.equal(await f.read('dist/.nojekyll'), '');
  assert.equal(JSON.parse(await f.read('dist/release.json')).commit, releaseA);
});

test('entry and nested iframe resources get one release version while keeping query, fragment and subpath', async t => {
  const f = await fixture(t, {
    'index.html': `<script src="assets/app.js?v=old&amp;mode=read&amp;v=older"></script>
      <iframe src=assets/nested/quiz.html></iframe>
      <img src="assets/%E5%9B%BE%20%E6%A0%87.svg#view">
      <a href="assets/nested/quiz.html?mode=full#question">Quiz</a>`,
    'assets/app.js': '', 'assets/quiz.css': '', 'assets/图 标.svg': '<svg/>',
    'assets/nested/model.js': '',
    'assets/nested/quiz.html': `<link href='../quiz.css?mode=light&amp;v=old#theme' rel="stylesheet">
      <SCRIPT SRC = '../app.js?v=old'></SCRIPT><script src="model.js"></script>`
  });
  await f.build();
  const entry = await f.read('dist/index.html');
  const sourceUrls = attr(entry, 'src').map(value => urlFrom(value));
  assert.ok(sourceUrls.every(url => url.searchParams.get('v') === releaseA));
  assert.ok(sourceUrls.every(url => url.searchParams.getAll('v').length === 1));
  assert.equal(sourceUrls[0].searchParams.get('mode'), 'read');
  assert.equal(sourceUrls[1].pathname, '/game_slang_dic/assets/nested/quiz.html');
  assert.equal(decodeURIComponent(sourceUrls[2].pathname), '/game_slang_dic/assets/图 标.svg');
  assert.equal(sourceUrls[2].hash, '#view');
  const link = urlFrom(attr(entry, 'href')[0]);
  assert.equal(link.searchParams.get('v'), releaseA);
  assert.equal(link.searchParams.get('mode'), 'full'); assert.equal(link.hash, '#question');
  const quiz = await f.read('dist/assets/nested/quiz.html');
  const iframeBase = sourceUrls[1].href;
  const css = urlFrom(attr(quiz, 'href')[0], iframeBase);
  assert.equal(css.pathname, '/game_slang_dic/assets/quiz.css');
  assert.equal(css.searchParams.get('mode'), 'light'); assert.equal(css.searchParams.get('v'), releaseA); assert.equal(css.hash, '#theme');
  for (const value of attr(quiz, 'src')) assert.equal(urlFrom(value, iframeBase).searchParams.get('v'), releaseA);
});

test('external links, anchors, nonpublic files, comments and inline code remain unchanged', async t => {
  const untouched = `<link href="https://fonts.example.test/css?a=1&amp;b=2">
    <script src="//cdn.example.test/lib.js?v=provider"></script>
    <img src="data:image/svg+xml,%3Csvg%3E">
    <a href="#chapter">Chapter</a><a href="?lang=en">Language</a>
    <a href="mailto:editor@example.test">Mail</a>
    <a href="../backend/private.json">Outside</a>
    <img src="missing.png"><img src="assets/%zz.png">
    <div data-src="assets/app.js"></div>
    <!-- <script src="assets/app.js"></script> -->
    <script>const snippet = '<img src="assets/app.js">';</script>
    <style>.sample::after { content: '<a href="assets/app.js">'; }</style>`;
  const f = await fixture(t, { 'index.html': untouched, 'assets/app.js': '', 'backend/private.json': '{}' });
  await f.build();
  assert.equal(await f.read('dist/index.html'), untouched);
});

test('each release replaces the version and local builds use stable local-preview', async t => {
  const f = await fixture(t, { 'index.html': '<script src="assets/app.js?v=old"></script>', 'assets/app.js': '' });
  await f.build(releaseA);
  assert.equal(urlFrom(attr(await f.read('dist/index.html'), 'src')[0]).searchParams.get('v'), releaseA);
  await f.build(releaseB);
  const next = urlFrom(attr(await f.read('dist/index.html'), 'src')[0]);
  assert.equal(next.searchParams.get('v'), releaseB); assert.equal(next.searchParams.getAll('v').length, 1);
  await f.build(null);
  const local = await f.read('dist/index.html');
  assert.equal(urlFrom(attr(local, 'src')[0]).searchParams.get('v'), 'local-preview');
  assert.equal(JSON.parse(await f.read('dist/release.json')).commit, 'local-preview');
  await f.build(null); assert.equal(await f.read('dist/index.html'), local);
});

test('redirected dist is refused before cleanup and its target survives', async t => {
  const f = await fixture(t, { 'outside/keep.txt': 'must survive' });
  await symlink(join(f.root, 'outside'), join(f.root, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.build(), error => /Refusing to clean a build directory outside this repository/.test(error.stderr));
  assert.equal(await f.read('outside/keep.txt'), 'must survive');
});

test('current site build versions DNA entry plus all iframe CSS/scripts without changing inline JavaScript', async t => {
  const f = await fixture(t);
  await cp(join(project, 'index.html'), join(f.root, 'index.html'));
  await cp(join(project, 'assets'), join(f.root, 'assets'), { recursive: true });
  const sourceHtml = await f.read('index.html'), sourceQuiz = await f.read('assets/blackspeak-dna.html');
  await f.build();
  const entry = await f.read('dist/index.html'), quiz = await f.read('dist/assets/blackspeak-dna.html');
  const iframeUrl = attr(entry, 'src').find(value => value.startsWith('assets/blackspeak-dna.html'));
  assert.equal(urlFrom(iframeUrl).searchParams.get('v'), releaseA);
  const quizResources = [...attr(quiz, 'src'), ...attr(quiz, 'href')];
  assert.equal(quizResources.length, 5);
  for (const value of quizResources) assert.equal(urlFrom(value, urlFrom(iframeUrl).href).searchParams.get('v'), releaseA);
  for (const external of [...attr(sourceHtml, 'src'), ...attr(sourceHtml, 'href')].filter(value => /^(?:https?:|data:|#)/.test(value))) {
    assert.ok(entry.includes(external), external);
  }
  const inline = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match => !/\bsrc\s*=/.test(match[1])).map(match => match[2]);
  assert.deepEqual(inline(entry), inline(sourceHtml));
  inline(entry).forEach(script => new vm.Script(script));
  assert.equal(await f.read('index.html'), sourceHtml);
  assert.equal(await f.read('assets/blackspeak-dna.html'), sourceQuiz);
});
