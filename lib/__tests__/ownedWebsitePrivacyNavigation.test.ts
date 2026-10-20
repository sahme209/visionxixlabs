import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { publicDocumentationSnapshot, publicSummary } from '../../scripts/owned-website-ci.mjs';
const source = readFileSync(`${process.cwd()}/scripts/capture-owned-website.mjs`, 'utf8');
it('scopes the essential-only real pointer to the exact privacy dialog', () => {
 const target = { disabled: false, textContent: 'Essential only', getAttribute: () => null, scrollIntoView: vi.fn(), getBoundingClientRect: () => ({ x: 10, y: 20, width: 80, height: 40 }), contains: () => false };
 const dialog = { querySelectorAll: vi.fn(() => [target]) };
 const document = { querySelector: vi.fn(() => dialog), querySelectorAll: vi.fn(() => { throw Error('unscoped'); }), elementFromPoint: () => target };
 const helper = source.slice(source.indexOf('function pointerForControl('), source.indexOf('function controlToken('));
 const read = vm.compileFunction(`${helper}; return pointerForControl('Essential only');`, ['document', 'innerWidth', 'innerHeight']);
 expect(read(document, 360, 1000)).toEqual({ x: 50, y: 40 });
 expect(document.querySelector).toHaveBeenCalledWith('[role="dialog"][aria-labelledby="privacy-consent-title"]');
 expect(dialog.querySelectorAll).toHaveBeenCalledWith('button');
 expect(source.indexOf("await click('Essential only')")).toBeLessThan(source.indexOf("await frame('home-desktop')"));
 expect(source).toContain("!document.querySelector('[role=\"dialog\"][aria-labelledby=\"privacy-consent-title\"]')");
 expect(source).toContain("send('Input.dispatchMouseEvent'");
 expect(helper).not.toMatch(/localStorage|sessionStorage|\.click\(|fetch\(|\.style\s*=/);
});
it('publishes only three boolean documentation observations on documentation timeout', () => {
 const snapshot = { pathnameIsDocs: false, executionPresent: false, tourPresent: true };
 expect(publicDocumentationSnapshot(snapshot)).toEqual(snapshot);
 for (const value of [{ ...snapshot, url: 'PRIVATE' }, { ...snapshot, pathnameIsDocs: 'PRIVATE' }, Object.create(snapshot)]) expect(publicDocumentationSnapshot(value)).toBeNull();
 let reads = 0; const input = { ...snapshot }; Object.defineProperty(input, 'pathnameIsDocs', { enumerable: true, get() { reads++; return true; } });
 expect(publicDocumentationSnapshot(input)).toBeNull(); expect(reads).toBe(0);
 const summary = publicSummary('a'.repeat(40), { sourceHead: 'a'.repeat(40) }, { currentInteraction: 'documentation_check', failure: 'website_dom_timeout', documentationTimeoutSnapshot: snapshot, documentationPreWaitSnapshot: snapshot, evidence: ['essential_consent_selected', 'PRIVATE'] }, undefined, undefined);
 expect(publicSummary('a'.repeat(40), null, { currentInteraction: 'essential_consent_control' }, undefined, undefined).currentInteraction).toBe('essential_consent_control');
 expect(summary.documentationPreWaitSnapshot).toEqual(snapshot); expect(summary.documentationTimeoutSnapshot).toEqual(snapshot); expect(summary.completedEvidence).toEqual(['essential_consent_selected']);
 expect(publicSummary('a'.repeat(40), null, { currentInteraction: 'play', failure: 'website_dom_timeout', documentationTimeoutSnapshot: snapshot }, undefined, undefined).documentationTimeoutSnapshot).toBeNull();
});

it('keeps the pre-wait observation separate from a timeout observation at the absolute deadline', () => {
 const snapshot = { pathnameIsDocs: false, executionPresent: false, tourPresent: true };
 const summary = publicSummary('a'.repeat(40), null, { currentInteraction: 'documentation_check', failure: 'website_driver_deadline', documentationPreWaitSnapshot: snapshot }, undefined, undefined);
 expect(summary.documentationPreWaitSnapshot).toEqual(snapshot); expect(summary.documentationTimeoutSnapshot).toBeNull();
 expect(source).toContain('documentationPreWaitSnapshot = await evaluate');
 expect(source.indexOf('documentationPreWaitSnapshot = await evaluate')).toBeLessThan(source.indexOf("try { await waitFor(() => location.pathname === '/docs/approval-workflow'"));
});
