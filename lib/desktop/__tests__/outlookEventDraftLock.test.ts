/** @vitest-environment jsdom */
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
const fixture = vi.hoisted(() => ({ request: vi.fn(), config: {} }));
vi.mock('../../../desktop/src/lib/desktopClient', () => ({ desktopClient: { config: fixture.config, getContextRevision: () => 0, subscribeContext: () => () => {} } }));
vi.mock('../../../desktop/src/lib/outlookTransport', () => ({ outlookActionsRequest: fixture.request }));
import { OutlookActionsPanel } from '../../../desktop/src/components/OutlookActionsPanel';
const available = () => ({ ok: true, data: { enabled: false, canRequest: true, actions: [], truncated: false } });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
async function eventDraft() {
  fixture.request.mockResolvedValueOnce(available());
  render(createElement(OutlookActionsPanel));
  await screen.findByText('Execution is not activated. Saved reviews remain available.');
  fireEvent.click(screen.getByText('Prepare an email or event draft'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Action' }), { target: { value: 'outlook_event_create' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Required attendees/ }), { target: { value: 'test@example.invalid' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), { target: { value: 'Synthetic draft' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Exact plain-text content' }), { target: { value: 'No provider action' } });
  const start = screen.getByLabelText(/^Start/) as HTMLInputElement;
  const end = screen.getByLabelText('End') as HTMLInputElement;
  fireEvent.change(start, { target: { value: '2026-12-01T10:00' } });
  fireEvent.change(end, { target: { value: '2026-12-01T11:00' } });
  return { start, end, save: screen.getByRole('button', { name: 'Save exact action for review' }) };
}
it('locks both event times while their exact draft save is pending, then restores editing on success', async () => {
  const { start, end, save } = await eventDraft();
  expect(start.disabled).toBe(false); expect(end.disabled).toBe(false);
  let finish!: (value: ReturnType<typeof available>) => void;
  fixture.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(save);
  expect(start.disabled).toBe(true); expect(end.disabled).toBe(true);
  expect(save).toHaveProperty('disabled', true);
  await act(async () => finish(available()));
  expect(start.disabled).toBe(false); expect(end.disabled).toBe(false);
  expect(start.value).toBe('2026-12-01T10:00'); expect(end.value).toBe('2026-12-01T11:00');
  const request = fixture.request.mock.calls[1][1];
  expect(request).toMatchObject({ action: 'request', kind: 'outlook_event_create', subject: 'Synthetic draft', body: 'No provider action', attendees: ['test@example.invalid'] });
  expect(request.startUtc).toBe(new Date('2026-12-01T10:00').toISOString());
  expect(request.endUtc).toBe(new Date('2026-12-01T11:00').toISOString());
  expect(fixture.request).toHaveBeenCalledTimes(2);
});
it('keeps times locked after an uncertain save and absent readback until the original draft is confirmed', async () => {
  const { start, end, save } = await eventDraft();
  fixture.request.mockResolvedValueOnce({ ok: false, error: 'Synthetic unknown save' });
  fireEvent.click(save);
  await screen.findByText('Synthetic unknown save');
  expect(start.disabled).toBe(true); expect(end.disabled).toBe(true);
  expect(save).toHaveProperty('disabled', true);
  fixture.request.mockResolvedValueOnce(available());
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved actions' }));
  await screen.findByText(/last draft save is still unconfirmed/);
  expect(start.disabled).toBe(true); expect(end.disabled).toBe(true);
  const original = fixture.request.mock.calls[1][1];
  fixture.request.mockResolvedValueOnce({ ok: true, data: { ...available().data, actions: [{
    id: 'synthetic-action', state: 'requested', attemptCount: 0, version: 0,
    intentDigest: 'a'.repeat(64), canApprove: false, canExecute: false, canCancel: false, canRecover: false,
    intent: { ...original, provider: 'outlook', accountId: 'synthetic-mailbox', expiresAt: '2026-12-01T12:00:00.000Z' },
  }] } });
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved actions' }));
  await screen.findByText('Calendar event');
  expect(start.disabled).toBe(false); expect(end.disabled).toBe(false);
  expect(start.value).toBe('2026-12-01T10:00'); expect(end.value).toBe('2026-12-01T11:00');
  expect(fixture.request.mock.calls.filter(call => call[1]?.action === 'request')).toHaveLength(1);
});
