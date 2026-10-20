import { afterEach, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Builtins-only adapter: importing it never starts the owned fixture.
import { collect, pngDimensions, privateFile, publicDomSnapshot, publicSummary, reviewManifest, screenshotNames } from '../../scripts/owned-website-ci.mjs';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
const sha = 'a'.repeat(40);
const root = realpathSync(process.cwd());
const manifest = { schema: 1, root, sourceHead: sha, productionEquivalent: false, hashes: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i), sha])), framework: { version: 'test' } };
function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), 'website-ci-test-')); directories.push(temporary);
  const directory = join(temporary, 'axiom-website-Ab1234'); mkdirSync(directory, { mode: 0o700 });
  const config = { root, directory, nonce: 'b'.repeat(32), hashes: manifest.hashes, framework: manifest.framework };
  const put = (name: string, data: unknown) => writeFileSync(join(directory, name), JSON.stringify(data), { mode: 0o600 });
  put('config.json', config);
  const destination = join(temporary, 'public');
  return { temporary, directory, config, put, destination, run: () => collect({ manifest, expected: sha, temporary, destination }) };
}
it('binds actual checkout and clean source to supplied PR head, never synthetic GITHUB_SHA', () => {
  expect(reviewManifest(manifest, sha, root, sha, '')).toEqual(manifest);
  expect(() => reviewManifest(manifest, 'z'.repeat(40), root, sha, '')).toThrow();
  expect(() => reviewManifest(manifest, sha, root, 'c'.repeat(40), '')).toThrow();
  expect(() => reviewManifest(manifest, sha, root, sha, ' M app/page.tsx')).toThrow();
});
it('does not label capture-only or unfinished cleanup a successful application acceptance', () => {
  const result = { sourceHead: sha, status: 'driver_finished', sourceUnchanged: true, cleanup: 'failed', error: 'PRIVATE_URL' };
  const summary = publicSummary(sha, result, { success: true, timedOutOperation: 'PRIVATE_URL' }, { success: true, nonce: 'n' }, 'n');
  expect(summary.outcome).toBe('failed'); expect(summary.timedOutOperation).toBe('unclassified');
  expect(JSON.stringify(summary)).not.toContain('PRIVATE_URL');
  expect(publicSummary(sha, { ...result, cleanup: 'owned_groups_empty' }, { success: true }, { success: true, nonce: 'n' }, 'n').outcome).toBe('passed');
  expect(() => publicSummary(sha, result, {}, { nonce: 'other' }, 'n')).toThrow();
});
it('retains only allowlisted failure, DOM phase, six primitives and cleanup codes', () => {
  const snapshot = { readyState: 'complete', tourPresent: true, playPresent: true, playDisabled: true, reducedMotion: false, visibility: 'visible' };
  const summary = publicSummary(sha, { sourceHead: sha, cleanupErrors: ['website_cleanup_incomplete', 'PRIVATE_URL?token=secret', 'PRIVATE_URL?token=secret'] }, { failure: 'website_dom_timeout', preImageWait: { phase: 'homepage_playback', lastDomSnapshot: snapshot } }, undefined, undefined);
  expect(summary.captureFailure).toBe('website_dom_timeout'); expect(summary.preImagePhase).toBe('homepage_playback');
  expect(summary.preImageDomSnapshot).toEqual(snapshot);
  expect(summary.cleanupErrors).toEqual(['website_cleanup_incomplete', 'unclassified']);
  expect(JSON.stringify(summary)).not.toContain('PRIVATE_URL');
  const refused = publicSummary(sha, { sourceHead: sha }, { failure: 'website_secret_token', preImageWait: { phase: 'PRIVATE_URL', lastDomSnapshot: { ...snapshot, readyState: 'PRIVATE_URL' } } }, undefined, undefined);
  expect(refused.captureFailure).toBe('unclassified'); expect(refused.preImagePhase).toBeNull(); expect(refused.preImageDomSnapshot).toBeNull();
  expect(JSON.stringify(refused)).not.toMatch(/PRIVATE_URL|website_secret_token/);
});
it('does not leak unknown DOM fields or malformed primitive observations', () => {
  const snapshot = { readyState: 'interactive', tourPresent: true, playPresent: false, playDisabled: null, reducedMotion: false, visibility: 'hidden' };
  expect(publicDomSnapshot(snapshot)).toEqual(snapshot);
  for (const malformed of [{ ...snapshot, url: 'PRIVATE_URL' }, { ...snapshot, readyState: 'PRIVATE_URL' }, { ...snapshot, reducedMotion: 'PRIVATE_URL' }, { ...snapshot, playDisabled: true }]) expect(publicDomSnapshot(malformed)).toBeNull();
  let reads = 0; const accessor = { ...snapshot }; Object.defineProperty(accessor, 'visibility', { enumerable: true, get() { reads++; return 'PRIVATE_URL'; } });
  expect(publicDomSnapshot(accessor)).toBeNull(); expect(reads).toBe(0);
});
it('publishes only bounded exception counts, closed classes and structured cleanup metadata', () => {
  const result = { sourceHead: sha, cleanupDiagnostics: [{ role: 'browser', stage: 'stop_group', errorCode: 'ENOENT', path: 'PRIVATE' }, { role: 'PRIVATE', stage: 'PRIVATE', errorCode: 'PRIVATE' }] };
  const capture = { evaluationExceptionClass: 'TypeError', runtimeExceptionCount: 2, homeCapturePhase: 'document_ready_before_playback', preImageWait: { phase: 'homepage_playback', predicateExceptionClass: 'PRIVATE' } };
  const summary = publicSummary(sha, result, capture, undefined, undefined);
  expect(summary.evaluationExceptionClass).toBe('TypeError'); expect(summary.predicateExceptionClass).toBe('other'); expect(summary.runtimeExceptionCount).toBe(2);
  expect(summary.cleanupDiagnostics).toEqual([{ role: 'browser', stage: 'stop_group', errorCode: 'ENOENT' }, { role: 'other', stage: 'other', errorCode: 'other' }]);
  expect(JSON.stringify(summary)).not.toContain('PRIVATE');
  expect(publicSummary(sha, result, { runtimeExceptionCount: 129, evaluationExceptionClass: 'PRIVATE', homeCapturePhase: 'PRIVATE' }, undefined, undefined)).toMatchObject({ runtimeExceptionCount: null, evaluationExceptionClass: 'other', homeCapturePhase: null });
});
it('collects a failed window as closed public fields without config, logs or profile data', () => {
  const f = fixture(); f.put('result.json', { sourceHead: sha, status: 'failed', cleanup: 'owned_groups_empty', sourceUnchanged: true, error: 'PRIVATE' });
  f.put('capture.json', { success: false, timedOutOperation: 'cdp.Page.navigate' });
  f.put('done.json', { success: false, nonce: f.config.nonce });
  writeFileSync(join(f.directory, 'bounded-runtime.log'), 'PRIVATE');
  expect(f.run().outcome).toBe('failed');
  const output = readFileSync(join(f.destination, 'summary.json'), 'utf8');
  expect(output).toContain('cdp.Page.navigate'); expect(output).not.toContain('PRIVATE'); expect(output).not.toContain(f.directory);
});
it('refuses symlink inputs, nonprivate files and preexisting upload destinations', () => {
  const f = fixture(); const target = join(f.directory, 'target'); writeFileSync(target, '{}', { mode: 0o600 });
  symlinkSync(target, join(f.directory, 'result.json')); expect(() => f.run()).toThrow();
  chmodSync(target, 0o644); expect(() => privateFile(target)).toThrow();
  rmSync(join(f.directory, 'result.json')); mkdirSync(f.destination);
  expect(() => f.run()).toThrow('website_ci_existing_destination');
});
it('rejects source drift, ambiguous ownership and unknown screenshot files', () => {
  const f = fixture(); f.put('config.json', { ...f.config, hashes: {} }); expect(() => f.run()).toThrow();
  f.put('config.json', f.config); mkdirSync(join(f.directory, 'screenshots'), { mode: 0o700 });
  writeFileSync(join(f.directory, 'screenshots', 'secret.txt'), 'private', { mode: 0o600 });
  expect(() => f.run()).toThrow('website_ci_unknown_image');
  rmSync(join(f.directory, 'screenshots'), { recursive: true });
  const second = join(f.temporary, 'axiom-website-Zz1234'); mkdirSync(second, { mode: 0o700 });
  writeFileSync(join(second, 'config.json'), JSON.stringify({ ...f.config, directory: second }), { mode: 0o600 });
  expect(() => f.run()).toThrow('website_ci_ambiguous_window');
});
it('rejects malformed and oversized PNG dimensions', () => {
  expect(() => pngDimensions(Buffer.from('not png'))).toThrow();
  const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(13, 8); png.write('IHDR', 12); png.writeUInt32BE(1441, 16); png.writeUInt32BE(900, 20);
  expect(() => pngDimensions(png)).toThrow('website_ci_png_dimensions');
});
it('refuses malformed ownership nonces and conflicting source receipts', () => {
  const f = fixture(); f.put('config.json', { ...f.config, nonce: 'not-an-owner-nonce' });
  expect(() => f.run()).toThrow();
  f.put('config.json', f.config); f.put('result.json', { sourceHead: 'c'.repeat(40), status: 'failed' });
  expect(() => f.run()).toThrow('website_ci_result_source');
});
it('publishes only the complete named image set with successful matching receipts, allowing CSS fractional clips', () => {
  const f = fixture(); const images = join(f.directory, 'screenshots'); mkdirSync(images, { mode: 0o700 });
  const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(13, 8); png.write('IHDR', 12); png.writeUInt32BE(360, 16); png.writeUInt32BE(900, 20);
  for (const name of screenshotNames) writeFileSync(join(images, name), png, { mode: 0o600 });
  f.put('result.json', { sourceHead: sha, status: 'driver_finished', cleanup: 'owned_groups_empty', sourceUnchanged: true });
  f.put('done.json', { success: true, nonce: f.config.nonce });
  f.put('capture.json', { success: true, images: screenshotNames.map(name => ({ path: join(images, name), width: 359.5, height: 899.5 })) });
  expect(f.run().outcome).toBe('passed');
  expect(JSON.parse(readFileSync(join(f.destination, 'summary.json'), 'utf8')).images).toHaveLength(6);
  rmSync(f.destination, { recursive: true });
  f.put('capture.json', { success: true, images: screenshotNames.map(name => ({ path: join(images, name), width: 300, height: 899.5 })) });
  expect(() => f.run()).toThrow('website_ci_image_receipt');
});
it('keeps CI isolated, PR-head bound and source-pins the adapter without altering guards', () => {
  const workflow = readFileSync(join(root, '.github/workflows/website-visual.yml'), 'utf8');
  expect(workflow).toContain('ref: ${{ github.event.pull_request.head.sha }}');
  expect(workflow).toContain('AXIOM_WEBSITE_CI_SOURCE_SHA: ${{ github.event.pull_request.head.sha }}');
  expect(workflow).toContain('path: website-source');
  expect(workflow).toContain('working-directory: website-source');
  expect(workflow).not.toMatch(/safe\.directory|chown/);
  expect(workflow).toContain('persist-credentials: false'); expect(workflow).toContain('contents: read');
  expect(workflow).toContain('timeout-minutes: 20'); expect(workflow).toContain('npm ci --ignore-scripts');
  expect(workflow).not.toMatch(/pull_request_target|workflow_run|secrets\.|DATABASE_URL|vercel|docker.sock|GITHUB_SHA:|NODE_OPTIONS:/);
  expect(workflow).toContain("steps.collect.outputs.ready == 'true'");
  expect(readFileSync(join(root, 'scripts/run-owned-website-visual.mjs'), 'utf8')).toContain("'scripts/owned-website-ci.mjs'");
});
