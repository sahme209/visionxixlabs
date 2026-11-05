/** @vitest-environment jsdom */
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/docs/getting-started' }));
import { DocsContents } from '@/components/docs/DocsContents';
let wide = true;
const listeners = new Set<(event: MediaQueryListEvent) => void>();
beforeEach(() => {
 wide = true; listeners.clear();
 vi.stubGlobal('matchMedia', vi.fn(() => ({
  get matches() { return wide; }, media: '(min-width: 1024px)',
  addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
  removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
 })));
});
afterEach(() => { cleanup(); listeners.clear(); vi.unstubAllGlobals(); });
function resize(matches: boolean) { act(() => { wide = matches; for (const listener of listeners) listener({ matches } as MediaQueryListEvent); }); }
it('moves focus from contents hidden by a wide-to-narrow change to the visible disclosure', () => {
 render(createElement(DocsContents));
 const field = screen.getByRole('searchbox', { name: 'Find a guide' }); field.focus();
 resize(false);
 expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Documentation contents' }));
});
it('moves focus from the narrow-only disclosure to visible guide search when becoming wide', () => {
 wide = false; render(createElement(DocsContents));
 screen.getByRole('button', { name: 'Documentation contents' }).focus();
 resize(true);
 expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Find a guide' }));
});
it('preserves focus outside contents during both breakpoint transitions', () => {
 render(createElement('div', null, createElement(DocsContents), createElement('button', null, 'Article action')));
 const outside = screen.getByRole('button', { name: 'Article action' }); outside.focus();
 resize(false); expect(document.activeElement).toBe(outside);
 resize(true); expect(document.activeElement).toBe(outside);
});
it('keeps expanded narrow contents and the current guide filter focused through resize', () => {
 wide = false; render(createElement(DocsContents));
 const button = screen.getByRole('button', { name: 'Documentation contents' }); fireEvent.click(button);
 const field = screen.getByRole('searchbox', { name: 'Find a guide' }); fireEvent.change(field, { target: { value: 'setup' } }); field.focus();
 resize(true); resize(false);
 expect(document.activeElement).toBe(field); expect(button.getAttribute('aria-expanded')).toBe('true');
 expect((field as HTMLInputElement).value).toBe('setup');
});
