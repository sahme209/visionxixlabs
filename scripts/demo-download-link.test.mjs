import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hasActionableDemoDownloadLink as check } from './demo-download-link.mjs';

for (const [name, source] of [
  ['current Demo source', readFileSync(new URL('../app/demo/page.tsx', import.meta.url), 'utf8')],
  ['current wording', '<Link href="/download">Check available downloads</Link>'],
  ['previous wording', '<a href="/download">Download the desktop app</a>'],
  ['literal expressions and nested text', '<a href={"/download"}><span>DOWNLOADS</span>{" available"}</a>'],
  ['explicit enabled state', '<a href="/download" disabled={false} aria-disabled="false">Downloads</a>'],
]) test(`accepts ${name}`, () => assert.equal(check(source), true));

for (const [name, source] of [
  ['comment coincidence', '// <a href="/download">Download the desktop app</a>'],
  ['string coincidence', 'const example = \'<a href="/download">Download the desktop app</a>\';'],
  ['unrelated label', '<><a href="/download">Explore</a><p>Download the desktop app</p></>'],
  ['wrong target', '<a href="/auth/signup">Download the desktop app</a>'],
  ['API target', '<a href="/api/download">Download the desktop app</a>'],
  ['dynamic target', '<a href={target}>Download the desktop app</a>'],
  ['dynamic label', '<a href="/download">{label}</a>'],
  ['partially dynamic label', '<a href="/download">Downloads {label}</a>'],
  ['disabled', '<a href="/download" disabled>Download the desktop app</a>'],
  ['aria disabled', '<a href="/download" aria-disabled={true}>Download the desktop app</a>'],
  ['unknown disabled', '<a href="/download" disabled={state}>Download the desktop app</a>'],
  ['spread overrides', '<a href="/download" {...props}>Download the desktop app</a>'],
  ['hidden label', '<a href="/download"><span hidden>Download the desktop app</span>Explore</a>'],
  ['non-link element', '<button href="/download">Download the desktop app</button>'],
  ['word coincidence', '<a href="/download">Predownloaded</a>'],
  ['parse failure', '<a href="/download">Download the desktop app</'],
]) test(`rejects ${name}`, () => assert.equal(check(source), false));

// Match the native archive's dependency layout without root node_modules.
test('loads the declared desktop parser in an isolated native layout', () => {
  const stage = mkdtempSync(path.join(tmpdir(), 'axiom-demo-parser-'));
  try {
    mkdirSync(path.join(stage, 'scripts'));
    mkdirSync(path.join(stage, 'desktop', 'node_modules'), { recursive: true });
    writeFileSync(path.join(stage, 'desktop', 'package.json'), '{"private":true}');
    symlinkSync(fileURLToPath(new URL('../desktop/node_modules/typescript', import.meta.url)),
      path.join(stage, 'desktop', 'node_modules', 'typescript'), 'dir');
    writeFileSync(path.join(stage, 'scripts', 'demo-download-link.mjs'),
      readFileSync(new URL('./demo-download-link.mjs', import.meta.url)));
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import { hasActionableDemoDownloadLink as check } from './scripts/demo-download-link.mjs';
       if (!check('<a href="/download">Check available downloads</a>')) process.exit(1);`],
      { cwd: stage, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});
