/** @vitest-environment jsdom */
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/docs/getting-started' }));
import { DocsContents } from '@/components/docs/DocsContents';
beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false }))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  { name: 'native composition', isComposing: true, keyCode: 27 },
  { name: 'legacy IME key code', isComposing: false, keyCode: 229 },
])('leaves $name Escape with the input method, then handles an ordinary Escape', ({ isComposing, keyCode }) => {
  render(createElement(DocsContents));
  const button = screen.getByRole('button', { name: 'Documentation contents' });
  fireEvent.click(button);
  const field = screen.getByRole('searchbox', { name: 'Find a guide' });
  fireEvent.change(field, { target: { value: 'Getting' } }); field.focus();
  const composingEscape = new KeyboardEvent('keydown', { key: 'Escape', keyCode, isComposing, bubbles: true, cancelable: true });
  fireEvent(field, composingEscape);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(field);
  expect((field as HTMLInputElement).value).toBe('Getting');
  expect(composingEscape.defaultPrevented).toBe(false);
  const ordinaryEscape = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true });
  fireEvent(field, ordinaryEscape);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(button);
  expect(ordinaryEscape.defaultPrevented).toBe(true);
});
