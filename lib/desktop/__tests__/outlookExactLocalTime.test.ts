/** @vitest-environment jsdom */
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const fixture = vi.hoisted(() => ({ request: vi.fn(), config: {} }));
vi.mock('../../../desktop/src/lib/desktopClient', () => ({ desktopClient: { config: fixture.config, getContextRevision: () => 0, subscribeContext: () => () => {} } }));
vi.mock('../../../desktop/src/lib/outlookTransport', () => ({ outlookActionsRequest: fixture.request }));
import { OutlookActionsPanel } from '../../../desktop/src/components/OutlookActionsPanel';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
async function draft(start: string, end: string) {
  fixture.request.mockResolvedValue({ ok: true, data: { enabled: false, canRequest: true, actions: [], truncated: false } });
  render(createElement(OutlookActionsPanel));
  await screen.findByText('Execution is not activated. Saved reviews remain available.');
  fireEvent.click(screen.getByText('Prepare an email or event draft'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Action' }), { target: { value: 'outlook_event_create' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Required attendees/ }), { target: { value: 'test@example.invalid' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), { target: { value: 'Synthetic DST draft' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Exact plain-text content' }), { target: { value: 'No real event' } });
  fireEvent.change(screen.getByLabelText(/^Start/), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('End'), { target: { value: end } });
  fireEvent.click(screen.getByRole('button', { name: 'Save exact action for review' }));
}
it.each([
  ['2027-03-14T02:30', '2027-03-14T04:00'],
  ['2027-03-14T01:30', '2027-03-14T02:30'],
])('refuses a nonexistent local event time rather than changing it: %s → %s', async (start, end) => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York');
  await draft(start, end);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Choose valid start and end times. Local times will be shown as exact UTC in the saved review.');
  expect(fixture.request.mock.calls.filter(call => call[1]?.action === 'request')).toHaveLength(0);
});
it('preserves valid times on opposite sides of the spring-forward gap', async () => {
  await draft('2027-03-14T01:30', '2027-03-14T03:30');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save exact action for review' })).toHaveProperty('disabled', false));
  const sent = fixture.request.mock.calls.filter(call => call[1]?.action === 'request');
  expect(sent).toHaveLength(1);
  expect(sent[0][1]).toMatchObject({ startUtc: '2027-03-14T06:30:00.000Z', endUtc: '2027-03-14T07:30:00.000Z' });
});

import { outlookLocalTimeToUtc } from '../../../desktop/src/lib/outlookLocalTime';
it.each([
  ['2026-12-01T10:00', '2026-12-01T15:00:00.000Z'],
  ['2026-12-01T10:00:30.12', '2026-12-01T15:00:30.120Z'],
  ['2027-07-01T10:00', '2027-07-01T14:00:00.000Z'],
])('preserves valid local precision and offset: %s', (local, utc) => {
  expect(outlookLocalTimeToUtc(local)).toBe(utc);
});
it.each([
  '', '2026-02-30T12:00', '2026-12-01T24:00', '2026-12-01T10:60',
  '2026-12-01T10:00:60', '2026-12-01', '2026-12-01T10:00Z',
  '2026-12-01T10:00-05:00', '2026-12-01T10:00\n',
  '2026-12-01T10:00:30.1234',
])('refuses invalid or non-local datetime input %j', local => {
  expect(() => outlookLocalTimeToUtc(local)).toThrow('invalid_outlook_local_time');
});
