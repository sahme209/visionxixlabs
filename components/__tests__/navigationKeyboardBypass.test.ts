/** @vitest-environment jsdom */
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/product' }));
vi.mock('@heroicons/react/24/outline', () => ({ Bars3Icon: () => null, XMarkIcon: () => null }));
import { Navigation } from '../Navigation';
const originalWidth = window.innerWidth;
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});
const renderPage = (mainProps = {}) => render(createElement('div', null,
  createElement(Navigation), createElement('main', mainProps, 'Current page')));
it('puts one native bypass first in navigation focus order and focuses the current main', () => {
  renderPage();
  const navigation = screen.getByRole('navigation');
  const skip = screen.getByRole('button', { name: 'Skip to content' });
  expect(screen.getAllByRole('button', { name: 'Skip to content' })).toHaveLength(1);
  expect(skip.getAttribute('type')).toBe('button');
  expect(navigation.querySelector('a[href],button,[tabindex]')).toBe(skip);
  expect(navigation.firstElementChild?.className).toContain('backdrop-blur-xl');
  skip.focus(); fireEvent.click(skip);
  const main = screen.getByRole('main');
  expect(document.activeElement).toBe(main);
  expect(main.getAttribute('tabindex')).toBe('-1');
  expect(main.hasAttribute('id')).toBe(false);
});
it('preserves the main landmark existing ID and tabindex', () => {
  renderPage({ id: 'page-owned-target', tabIndex: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Skip to content' }));
  const main = screen.getByRole('main');
  expect(document.activeElement).toBe(main);
  expect(main.id).toBe('page-owned-target');
  expect(main.getAttribute('tabindex')).toBe('0');
});
it('closes More before leaving navigation focus', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  expect(screen.getByRole('group', { name: 'More destinations' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Skip to content' }));
  expect(screen.queryByRole('group', { name: 'More destinations' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('main'));
});
it('closes the mobile disclosure and restores scroll while retaining main focus', () => {
  renderPage();
  const skip = screen.getByRole('button', { name: 'Skip to content' });
  document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'scroll';
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
  expect(screen.getByRole('dialog')).toBeDefined();
  fireEvent.click(skip);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('auto');
  expect(document.documentElement.style.overflow).toBe('scroll');
  expect(document.activeElement).toBe(screen.getByRole('main'));
  document.body.style.overflow = ''; document.documentElement.style.overflow = '';
});
it('safely leaves focus on the bypass when the page has no main', () => {
  render(createElement(Navigation));
  const skip = screen.getByRole('button', { name: 'Skip to content' });
  skip.focus();
  expect(() => fireEvent.click(skip)).not.toThrow();
  expect(document.activeElement).toBe(skip);
});
