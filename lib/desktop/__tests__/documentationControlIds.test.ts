/** @vitest-environment jsdom */
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
const boundary = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../../desktop/src/lib/notifications', () => ({ openExternal: boundary.open }));
import { DocsView } from '../../../desktop/src/views/DocsView';
import desktopPackage from '../../../desktop/package.json';
import { deploymentIntakeSchema } from '../../tauri/deploymentIntakeSchema';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
const journeys = [
  ['Open repository', 'documentation.journey.scope', 'repository-workspace'],
  ['Open Agent', 'documentation.journey.code', 'agent'],
  ['Open Deployments', 'documentation.journey.govern', 'deployment-requests'],
  ['Open Batches', 'documentation.journey.schedule', 'airflow-automation'],
  ['Review deployment evidence', 'documentation.journey.recover', 'deployment-requests'],
] as const;
const guides = [
  ['Product documentation', 'documentation.web.overview', 'https://visionxixlabs.com/docs'],
  ['Getting started', 'documentation.web.getting-started', 'https://visionxixlabs.com/docs/getting-started'],
  ['Permissions model', 'documentation.web.permissions', 'https://visionxixlabs.com/docs/permissions-model'],
  ['Approval workflow', 'documentation.web.approvals', 'https://visionxixlabs.com/docs/approval-workflow'],
  ['Deployment readiness', 'documentation.web.readiness', 'https://visionxixlabs.com/docs/releaseops/readiness'],
  ['AWS ECS rollback', 'documentation.web.rollback', 'https://visionxixlabs.com/docs/rollback'],
  ['Batch providers', 'documentation.web.batch-providers', 'https://visionxixlabs.com/docs/batch-providers'],
  ['Integration setup', 'documentation.web.integration-setup', 'https://visionxixlabs.com/docs/integration-setup'],
  ['Glossary', 'documentation.web.glossary', 'https://visionxixlabs.com/docs/glossary'],
  ['Troubleshooting', 'documentation.web.troubleshooting', 'https://visionxixlabs.com/docs/troubleshooting'],
  ['Surfaces', 'documentation.web.surfaces', 'https://visionxixlabs.com/docs/surfaces'],
] as const;
it('binds all journey and guide controls uniquely to their documented roles and purposes', () => {
  const { container } = render(createElement(DocsView, { onNavigate: vi.fn() }));
  const ids: string[] = [];
  for (const [label, id] of journeys) {
    const control = screen.getByRole('button', { name: label });
    expect(control.getAttribute('data-help-id')).toBe(id); ids.push(id);
  }
  for (const [label, id, href] of guides) {
    const control = screen.getByRole('link', { name: label });
    expect(control.getAttribute('data-help-id')).toBe(id);
    expect(control.getAttribute('href')).toBe(href); ids.push(id);
  }
  const mapId = screen.getByRole('button', {name: 'Workflow map'}).getAttribute('data-help-id');
  expect(mapId).toBe('documentation.workflow.open');
  ids.push(mapId!);
  expect(new Set(ids).size).toBe(ids.length);
  expect(container.querySelectorAll('[data-help-id]')).toHaveLength(ids.length);
  expect(screen.getByText(`Included with V19 Desktop ${desktopPackage.version}`)).toBeTruthy();
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
    fireEvent.click(screen.getByRole('link', { name: label }));
    expect(boundary.open).toHaveBeenLastCalledWith(href);
  }
  expect(boundary.open).toHaveBeenCalledTimes(guides.length);
  expect(navigate).toHaveBeenCalledTimes(5);
});

it('searches the guide list and focuses an in-page destination without opening a browser', () => {
  render(createElement(DocsView, {onNavigate: vi.fn()}));
  fireEvent.click(screen.getByRole('button', {name: 'Browse guides'}));
  const search = screen.getByRole('searchbox', {name: 'Search documentation'});
  expect(document.activeElement).toBe(search);
  fireEvent.change(search, {target: {value: 'deployments'}});
  const index = within(screen.getByRole('navigation', {name: 'Documentation guides'}));
  expect(index.getByRole('button', {name: 'Release governance'}).getAttribute('aria-current')).toBe('page');
  expect(index.getByRole('link', {name: 'Deployment readiness'})).toBeTruthy();
  expect(index.queryByRole('link', {name: 'Batch providers'})).toBeNull();
  fireEvent.change(search, {target: {value: 'troubleshooting'}});
  expect(screen.getByRole('link', {name: "Troubleshooting"})).toBeTruthy();
  expect(screen.queryByRole('link', {name: "Product documentation"})).toBeNull();
  const outline=screen.getByRole('navigation',{name:'On this page'});
  fireEvent.click(within(outline).getByRole('button',{name:'Release lifecycle'}));
  expect(document.activeElement?.id).toBe('release-lifecycle');
  fireEvent.click(within(outline).getByRole('button', {name: 'Overview'}));
  expect(document.activeElement).toBe(screen.getByRole('region', {name: 'Release governance'}));
  expect(boundary.open).not.toHaveBeenCalled();
});

it('finds built-in guide sections and preserves the selected source in the unsent Agent handoff', () => {
  const ask = vi.fn();
  const navigate = vi.fn();
  render(createElement(DocsView, {onNavigate: navigate, onAskAboutPage: ask}));
  const search = screen.getByRole('searchbox', {name: 'Search documentation'});
  const index = within(screen.getByRole('navigation', {name: 'Documentation guides'}));
  fireEvent.change(search, {target: {value: '  AIRFLOW  '}});
  const schedule = index.getByRole('button', {name: 'Schedule with Airflow'});
  fireEvent.click(schedule);
  expect(document.activeElement).toBe(screen.getByRole('listitem', {name: 'Schedule with Airflow'}));
  expect(schedule.getAttribute('aria-current')).toBe('location');
  expect(search).toHaveProperty('value', '  AIRFLOW  ');
  fireEvent.click(screen.getByRole('button', {name: 'Ask about this page'}));
  expect(ask).toHaveBeenCalledWith(expect.stringContaining('https://visionxixlabs.com/docs/getting-started#guide-stage-schedule'));
  expect(ask).toHaveBeenCalledWith(expect.stringContaining('Use an authorized Airflow connection'));
  expect(navigate).not.toHaveBeenCalled();
  expect(boundary.open).not.toHaveBeenCalled();
  fireEvent.change(search, {target: {value: 'example plan metadata'}});
  fireEvent.click(index.getByRole('button', {name: 'Example plan metadata'}));
  expect(document.activeElement?.id).toBe('example-plan-metadata');
  expect(index.queryByRole('button', {name: 'Schedule with Airflow'})).toBeNull();
});

it('uses slash only while the reader is active and outside an editor or composition', () => {
  const view = render(createElement(DocsView, {onNavigate: vi.fn()}));
  const search = screen.getByRole('searchbox', {name: 'Search documentation'});
  const browse = screen.getByRole('button', {name: 'Browse guides'});
  browse.focus();
  fireEvent.keyDown(browse, {key: '/', isComposing: true});
  expect(document.activeElement).toBe(browse);
  expect(fireEvent.keyDown(browse, {key: '/'})).toBe(false);
  expect(document.activeElement).toBe(search);
  expect(fireEvent.keyDown(search, {key: '/'})).toBe(true);
  view.rerender(createElement(DocsView, {onNavigate: vi.fn(), active: false}));
  browse.focus();
  expect(fireEvent.keyDown(browse, {key: '/'})).toBe(true);
  expect(document.activeElement).toBe(browse);
});

it('copies the canonical anchor and falls back to a selectable URL when the clipboard fails', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fixture_clipboard_denied'));
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
  try {
    render(createElement(DocsView, {onNavigate: vi.fn()}));
    const outline = screen.getByRole('navigation', {name: 'On this page'});
    const lifecycle = within(outline).getByRole('button', {name: 'Release lifecycle'});
    fireEvent.click(lifecycle);
    expect(lifecycle.getAttribute('aria-current')).toBe('location');
    const copy = within(screen.getByRole('article', {name: 'Release governance'})).getByRole('button', {name: 'Copy guide link', description: 'Release lifecycle'});
    fireEvent.click(copy);
    await screen.findByText('Guide link copied.');
    expect(writeText).toHaveBeenLastCalledWith('https://visionxixlabs.com/docs/releaseops#lifecycle');
    fireEvent.click(within(outline).getByRole('button', {name: 'Prepare a governed release'}));
    expect(screen.queryByText('Guide link copied.')).toBeNull();
    fireEvent.click(copy);
    const fallback = await screen.findByRole<HTMLInputElement>('textbox', {name: 'Guide link'});
    expect(fallback.value).toBe('https://visionxixlabs.com/docs/getting-started#workflow');
    expect(fallback.readOnly).toBe(true);
    fallback.focus();
    expect(fallback.selectionStart).toBe(0);
    expect(fallback.selectionEnd).toBe(fallback.value.length);
    expect(boundary.open).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('copies the documented release intake fields and offers a keyboard-selectable fallback', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fixture_clipboard_denied'));
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
  try {
    render(createElement(DocsView, {onNavigate: vi.fn()}));
    const outline = within(screen.getByRole('navigation', {name: 'On this page'}));
    const jump = outline.getByRole('button', {name: 'Example plan metadata'});
    fireEvent.click(jump);
    const example = screen.getByRole('region', {name: 'Example plan metadata'});
    expect(document.activeElement).toBe(example);
    expect(jump.getAttribute('aria-current')).toBe('location');
    expect(screen.getByRole('link', {name: 'Guide source'}).getAttribute('href'))
      .toBe('https://visionxixlabs.com/docs/getting-started#example-plan-metadata');
    const code = example.querySelector('pre code')!.textContent!;
    expect(code.split('\n')).toHaveLength(7);
    const lines = example.querySelector('pre [aria-hidden="true"]');
    expect(lines?.textContent?.split('\n')).toEqual(code.split('\n').map((_, index) => String(index + 1).padStart(2, '0')));
    const metadata = deploymentIntakeSchema.pick({applications: true, targetEnvironment: true, sourceBranch: true,
      prApprovalStatus: true, rollbackAvailability: true}).parse(JSON.parse(code));
    expect(metadata.prApprovalStatus).toBe('pending');
    const copy = within(example).getByRole('button', {name: 'Copy example metadata'});
    fireEvent.click(copy);
    await within(example).findByText('Example metadata copied.');
    expect(writeText).toHaveBeenLastCalledWith(code);
    fireEvent.click(copy);
    const fallback = await within(example).findByRole<HTMLTextAreaElement>('textbox', {name: 'Example metadata'});
    expect(fallback.value).toBe(code);
    expect(fallback.readOnly).toBe(true);
    fallback.focus();
    expect(fallback.selectionStart).toBe(0);
    expect(fallback.selectionEnd).toBe(code.length);
    expect(screen.queryByRole('textbox', {name: 'Guide link'})).toBeNull();
    expect(boundary.open).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('jumps to related guides without changing the reader section or opening an external link', () => {
  const ask = vi.fn();
  render(createElement(DocsView, {onNavigate: vi.fn(), onAskAboutPage: ask}));
  const outline = within(screen.getByRole('navigation', {name: 'On this page'}));
  const lifecycle = outline.getByRole('button', {name: 'Release lifecycle'});
  fireEvent.click(lifecycle);
  fireEvent.click(outline.getByRole('button', {name: 'Related guides'}));
  expect(document.activeElement).toBe(screen.getByRole('region', {name: 'Related guides'}));
  expect(lifecycle.getAttribute('aria-current')).toBe('location');
  expect(lifecycle.getAttribute('aria-controls')).toBe('release-lifecycle');
  expect(screen.getByText('Section', {selector:'dt'}).nextElementSibling?.textContent).toBe('Release lifecycle');
  expect(screen.getByRole('link', {name: 'Guide source'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/releaseops#lifecycle');
  fireEvent.click(screen.getByRole('button', {name: 'Ask about this page'}));
  expect(ask).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('https://visionxixlabs.com/docs/releaseops#lifecycle'));
  expect(boundary.open).not.toHaveBeenCalled();
});

it('opens the workflow map, follows a review branch and restores the guide reader', () => {
  const navigate = vi.fn();
  render(createElement(DocsView, {onNavigate: navigate}));
  const search = screen.getByRole<HTMLInputElement>('searchbox', {name: 'Search documentation'});
  fireEvent.change(search, {target: {value: 'release'}});
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  expect(document.activeElement).toBe(screen.getByRole('heading', {name: 'Release workflow map'}));
  expect(screen.queryByRole('navigation', {name: 'Documentation guides'})).toBeNull();

  const review = screen.getByRole('button', {name: 'Review current authority'});
  fireEvent.click(review);
  let details = screen.getByRole('complementary', {name: 'Review current authority'});
  const heading = within(details).getByRole('heading', {name: 'Review current authority'});
  expect(document.activeElement).toBe(heading);
  expect(document.getElementById(heading.getAttribute('aria-describedby')!)?.textContent).toBe('Map Step 4 of 11');
  expect(within(details).getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/approval-workflow#desktop-release-review');
  fireEvent.click(within(details).getByRole('button', {name: /Hold for review/}));
  details = screen.getByRole('complementary', {name: 'Hold for review'});
  expect(within(details).getByText('Step 5 of 11')).toBeTruthy();
  fireEvent.keyDown(within(details).getByRole('heading', {name: 'Hold for review'}), {key: 'Escape'});
  expect(document.activeElement).toBe(review);
  expect(screen.queryByRole('complementary', {name: 'Hold for review'})).toBeNull();

  fireEvent.click(screen.getByRole('button', {name: 'Zoom in'}));
  expect(screen.getByRole('button', {name: 'Reset zoom, current zoom 125%'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: 'Back to guides'}));
  expect(screen.getByRole<HTMLInputElement>('searchbox', {name: 'Search documentation'}).value).toBe('release');
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Workflow map'}));
  expect(navigate).not.toHaveBeenCalled();
  expect(boundary.open).not.toHaveBeenCalled();
});

it('switches between release and ticket maps without carrying the previous inspector', () => {
  const navigate = vi.fn();
  render(createElement(DocsView, {onNavigate: navigate}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  fireEvent.click(screen.getByRole('button', {name: 'Scope the change'}));
  const maps = within(screen.getByRole('navigation', {name: 'Workflow maps'}));
  fireEvent.click(maps.getByRole('button', {name: 'Tickets and recovery'}));
  expect(maps.getByRole('button', {name: 'Tickets and recovery'}).getAttribute('aria-pressed')).toBe('true');
  expect(maps.getByRole('heading', {name: 'Key workflows'})).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('heading', {name: 'Tickets and recovery workflow map'}));
  expect(screen.queryByRole('complementary', {name: 'Scope the change'})).toBeNull();

  fireEvent.click(screen.getByRole('button', {name: 'Open a recorded ticket'}));
  const intake = within(screen.getByRole('complementary', {name: 'Open a recorded ticket'}));
  fireEvent.click(intake.getByRole('button', {name: /Inspect the recorded change/}));
  const change = within(screen.getByRole('complementary', {name: 'Inspect the recorded change'}));
  expect(change.getByRole('button', {name: /Jira/})).toBeTruthy();
  fireEvent.click(change.getByRole('button', {name: /ServiceNow/}));
  const provider = within(screen.getByRole('complementary', {name: 'Review a saved ServiceNow action'}));
  expect(provider.getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/approval-workflow');
  expect(provider.getByText(/independent approval/)).toBeTruthy();

  fireEvent.click(maps.getByRole('button', {name: 'Release'}));
  expect(screen.getByRole('heading', {name: 'Release workflow map'})).toBeTruthy();
  expect(screen.queryByRole('complementary', {name: 'Review a saved ServiceNow action'})).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(boundary.open).not.toHaveBeenCalled();
});

it('links the Release closure step to the exact versioned evidence guide', () => {
  const navigate = vi.fn();
  render(createElement(DocsView, {onNavigate: navigate}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  const verify = screen.getByRole('button', {name: 'Verify the outcome'});
  fireEvent.click(verify);
  const details = within(screen.getByRole('complementary', {name: 'Verify the outcome'}));
  fireEvent.click(details.getByRole('button', {name: /Closure criteria met/}));
  const closure = within(screen.getByRole('complementary', {name: 'Record closure'}));
  expect(closure.getByText(/Read closure evidence/)).toBeTruthy();
  expect(closure.getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/surfaces#release-closure-evidence');
  fireEvent.keyDown(closure.getByRole('heading', {name: 'Record closure'}), {key: 'Escape'});
  expect(document.activeElement).toBe(verify);
  expect(navigate).not.toHaveBeenCalled();
  expect(boundary.open).not.toHaveBeenCalled();
});

it('connects saved Batches dependencies and confirmed closure to the archive guide', () => {
  const navigate = vi.fn();
  render(createElement(DocsView, {onNavigate: navigate}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  fireEvent.click(within(screen.getByRole('navigation', {name: 'Workflow maps'})).getByRole('button', {name:'Batches'}));
  const dependencies = screen.getByRole('button', {name: 'Select exact release dependencies'});
  fireEvent.click(dependencies);
  const panel = within(screen.getByRole('complementary', {name:'Select exact release dependencies'}));
  fireEvent.click(panel.getByRole('button', {name:/Find a closed release/}));
  const history = within(screen.getByRole('complementary', {name:'Find older closed releases'}));
  expect(history.getByRole('link', {name:'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/surfaces#batch-closed-history');
  expect(history.getByText(/Provider results and application health need their own evidence/)).toBeTruthy();
  fireEvent.keyDown(history.getByRole('heading', {name:'Find older closed releases'}), {key:'Escape'});
  expect(document.activeElement).toBe(dependencies);
  expect(navigate).not.toHaveBeenCalled();
  expect(boundary.open).not.toHaveBeenCalled();
});

it('explains batch waiting and recovery without granting release authority', () => {
  const navigate = vi.fn();
  render(createElement(DocsView, {onNavigate: navigate}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  const maps = within(screen.getByRole('navigation', {name: 'Workflow maps'}));
  fireEvent.click(maps.getByRole('button', {name: 'Batches'}));
  expect(screen.getByRole('heading', {name: 'Batch dependencies workflow map'})).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Inspect other batch providers, Read only'})).toBeTruthy();

  fireEvent.click(screen.getByRole('button', {name: 'Check the declared batches'}));
  const check = within(screen.getByRole('complementary', {name: 'Check the declared batches'}));
  fireEvent.click(check.getByRole('button', {name: /Waiting or unable to verify/}));
  const waiting = within(screen.getByRole('complementary', {name: 'Keep readiness unresolved'}));
  fireEvent.click(waiting.getByRole('button', {name: /Current version is available to check/}));
  fireEvent.click(check.getByRole('button', {name: /Run failed or task details needed/}));
  const tasks = within(screen.getByRole('complementary', {name: 'Inspect the run’s tasks'}));
  expect(tasks.getByText(/choose Inspect failed run/)).toBeTruthy();
  expect(tasks.getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/surfaces#batch-failed-run');
  fireEvent.click(tasks.getByRole('button', {name: /Refresh readiness for the selected version/}));
  fireEvent.click(check.getByRole('button', {name: /Run failed or task details needed/}));
  fireEvent.click(tasks.getByRole('button', {name: /Inspect release workflow evidence/}));
  const logs = within(screen.getByRole('complementary', {name: 'Open the release’s Logs'}));
  expect(logs.getByText(/Airflow task logs remain unavailable/)).toBeTruthy();
  expect(logs.getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/surfaces#batch-release-logs');
  fireEvent.click(logs.getByRole('button', {name: 'Close details'}));
  fireEvent.click(screen.getByRole('button', {name: 'Check the declared batches'}));
  const reopenedCheck = within(screen.getByRole('complementary', {name: 'Check the declared batches'}));
  fireEvent.click(reopenedCheck.getByRole('button', {name: /Required runs completed/}));
  const review = within(screen.getByRole('complementary', {name: 'Return to release review'}));
  expect(review.getByText(/does not grant execution authority/)).toBeTruthy();
  expect(review.getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe('https://visionxixlabs.com/docs/approval-workflow');
  expect(navigate).not.toHaveBeenCalled();
  expect(boundary.open).not.toHaveBeenCalled();
});

it.each([
  ['Inspect the recorded change', 'ticket-release-draft'],
  ['Inspect the release evidence', 'ticket-collection-receipt'],
])('links %s in the Tickets map to the exact public guide', (name, anchor) => {
  render(createElement(DocsView, {onNavigate: vi.fn()}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  fireEvent.click(screen.getByRole('button', {name: 'Tickets and recovery'}));
  const step = screen.getByRole('button', {name});
  fireEvent.click(step);
  const details = within(screen.getByRole('complementary', {name}));
  expect(details.getByRole('link', {name: 'Read the guide'}).getAttribute('href')).toBe(`https://visionxixlabs.com/docs/surfaces#${anchor}`);
  fireEvent.click(details.getByRole('button', {name: 'Close details'}));
  expect(document.activeElement).toBe(step);
});

it('fits the entire canvas and keeps step details open when jumping from the overview to a group', () => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  render(createElement(DocsView, {onNavigate: vi.fn()}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  const viewport = screen.getByRole('region', {name: 'Scrollable release workflow canvas'});
  const groups = screen.getByRole('navigation', {name: 'Workflow groups'});
  const groupButtons = within(groups).getAllByRole('button');
  const lastGroup = groupButtons.at(-1)!;
  const groupHeading = screen.getByRole('heading', {name: lastGroup.textContent!});
  Object.defineProperty(viewport, 'clientWidth', {value: groupButtons.length * 115});
  Object.defineProperty(groupHeading, 'scrollIntoView', {value: vi.fn()});
  fireEvent.click(screen.getByRole('button', {name: 'Scope the change'}));
  const fit = screen.getByRole('button', {name: 'Fit overview'});
  fireEvent.click(fit);
  expect(fit.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', {name: 'Reset zoom, current zoom 50%'})).toBeTruthy();
  expect(screen.getByRole('complementary', {name: 'Scope the change'})).toBeTruthy();
  fireEvent.click(lastGroup);
  expect(fit.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', {name: 'Reset zoom, current zoom 100%'})).toBeTruthy();
  expect(document.activeElement).toBe(groupHeading);
  expect(screen.getByRole('complementary', {name: 'Scope the change'})).toBeTruthy();
});

it('shows the recorded branch conditions on the map and in the selected decision details', () => {
  render(createElement(DocsView, {onNavigate: vi.fn()}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  const canvas = within(screen.getByRole('region', {name: 'Scrollable release workflow canvas'}));
  const decision = canvas.getByRole('button', {name: 'Review current authority'});
  expect(decision.querySelector('.studio-flow-decision')).toBeTruthy();
  expect(canvas.getByText('Current approval and authority')).toBeTruthy();
  expect(canvas.getByText('Rejected, expired or changed')).toBeTruthy();
  expect(canvas.queryByText('Return to review')).toBeNull();

  fireEvent.click(decision);
  const details = within(screen.getByRole('complementary', {name: 'Review current authority'}));
  expect(details.getByText('Release review')).toBeTruthy();
  fireEvent.click(details.getByRole('button', {name: /Rejected, expired or changed/}));
  const hold = within(screen.getByRole('complementary', {name: 'Hold for review'}));
  expect(hold.getByRole('button', {name: /Return to review/})).toBeTruthy();
});

it('uses the same selected step and restores its focus after switching to the grouped list', () => {
  render(createElement(DocsView, {onNavigate: vi.fn()}));
  fireEvent.click(screen.getByRole('button', {name: 'Workflow map'}));
  const viewport = screen.getByRole('region', {name: 'Scrollable release workflow canvas'});
  const step = within(viewport).getByRole('button', {name: 'Verify the outcome'});
  fireEvent.click(step);
  viewport.scrollLeft = 246;
  const toggle = screen.getByRole('button', {name: 'Step list'});
  fireEvent.click(toggle);
  const list = screen.getByRole('region', {name: 'Release workflow step list'});
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(within(list).getByRole('button', {name: 'Verify the outcome'})).toBe(step);
  expect(screen.queryByRole('group', {name: 'Canvas zoom'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Close details'}));
  expect(document.activeElement).toBe(step);
  list.scrollLeft = 0;
  fireEvent.click(toggle);
  expect(screen.getByRole('region', {name: 'Scrollable release workflow canvas'}).scrollLeft).toBe(246);
});

it('binds the workflow map help IDs to the current controls and regions', () => {
  const {container} = render(createElement(DocsView, {onNavigate: vi.fn()}));
  const open = screen.getByRole('button', {name: 'Workflow map'});
  expect(open.getAttribute('data-help-id')).toBe('documentation.workflow.open');
  fireEvent.click(open);
  fireEvent.click(screen.getByRole('button', {name: 'Review current authority'}));
  const controls = Array.from(container.querySelectorAll('[data-help-id^="documentation.workflow."]'));
  expect(controls.map(control => control.getAttribute('data-help-id')?.split('.').at(-1)).sort()).toEqual([
    'back', 'close-details', 'families', 'fit', 'groups', 'next-steps', 'read-guide', 'step-list', 'steps', 'zoom',
  ]);
});
