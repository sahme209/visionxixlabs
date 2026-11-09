/** @vitest-environment jsdom */
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const boundary = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../../desktop/src/lib/notifications', () => ({ openExternal: boundary.open }));
import { DocsView } from '../../../desktop/src/views/DocsView';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const journeys = [
  ['Open repository', 'documentation.journey.scope', 'repository-workspace'],
  ['Open Agent', 'documentation.journey.code', 'agent'],
  ['Open Releases', 'documentation.journey.govern', 'deployment-requests'],
  ['Open Batches', 'documentation.journey.schedule', 'airflow-automation'],
  ['Review deployment evidence', 'documentation.journey.recover', 'deployment-requests'],
] as const;
const guides = [
  ['Product documentation', 'documentation.web.overview', 'https://visionxixlabs.com/docs'],
  ['Getting started', 'documentation.web.getting-started', 'https://visionxixlabs.com/docs/getting-started'],
  ['Permissions model', 'documentation.web.permissions', 'https://visionxixlabs.com/docs/permissions-model'],
  ['Approval workflow', 'documentation.web.approvals', 'https://visionxixlabs.com/docs/approval-workflow'],
  ['Glossary', 'documentation.web.glossary', 'https://visionxixlabs.com/docs/glossary'],
  ['Troubleshooting', 'documentation.web.troubleshooting', 'https://visionxixlabs.com/docs/troubleshooting'],
  ['Surfaces', 'documentation.web.surfaces', 'https://visionxixlabs.com/docs/surfaces'],
] as const;
it('binds all twelve controls uniquely to their documented roles and purposes', () => {
  const { container } = render(createElement(DocsView, { onNavigate: vi.fn() }));
  const ids: string[] = [];
  for (const [label, id] of journeys) {
    const control = screen.getByRole('button', { name: label });
    expect(control.getAttribute('data-help-id')).toBe(id); ids.push(id);
  }
  for (const [label, id, href] of guides) {
    const control = screen.getByRole('link', { name: new RegExp(`^${label} `) });
    expect(control.getAttribute('data-help-id')).toBe(id);
    expect(control.getAttribute('href')).toBe(href); ids.push(id);
  }
  expect(new Set(ids).size).toBe(12);
  expect(container.querySelectorAll('[data-help-id]')).toHaveLength(12);
  expect(screen.getByText(/Check the installed version and stated availability/)).toBeTruthy();
  expect(screen.getByText(/A guide is not proof of end-to-end acceptance/)).toBeTruthy();
});
it('keeps identified journey navigation separate from outbound guide handoff', () => {
  const navigate = vi.fn(); render(createElement(DocsView, { onNavigate: navigate }));
  for (const [label, , destination] of journeys) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(navigate).toHaveBeenLastCalledWith(destination);
  }
  expect(navigate).toHaveBeenCalledTimes(5);
  expect(boundary.open).not.toHaveBeenCalled();
  for (const [label, , href] of guides) {
    fireEvent.click(screen.getByRole('link', { name: new RegExp(`^${label} `) }));
    expect(boundary.open).toHaveBeenLastCalledWith(href);
  }
  expect(boundary.open).toHaveBeenCalledTimes(7);
  expect(navigate).toHaveBeenCalledTimes(5);
});
