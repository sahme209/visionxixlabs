/* eslint-disable @typescript-eslint/no-require-imports -- Owned fixture process ledger with injectable boundaries. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
function createLedger({ spawn, snapshot, canonical, stopGroup, groupMembers, onChange = () => {}, onFailure = () => {}, registrationTimeout = 2000, waitExit = async record => {
  const deadline = Date.now() + 2000;
  while (!record.exited && !record.neverSpawned && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
} }) {
  const records = [];
  let journalFailed = false;
  const report = () => records.map(record => ({ role: record.role, pid: record.pid, expected: record.expected, owner: record.owner, state: record.exited ? 'exited' : record.neverSpawned ? 'spawn_failed' : record.owner ? 'registered' : 'pending', exited: record.exited, neverSpawned: record.neverSpawned, exitCode: record.exitCode, signal: record.signal }));
  function publish() {
    try { onChange(report()); }
    catch { journalFailed = true; const error = Error('website_ledger_persistence_failed'); onFailure(error); throw error; }
  }
  function publishEvent() { try { publish(); } catch { /* failure already cancels supervisor; event handlers must not throw */ } }
  async function launch(executable, args, options, observe = () => {}, role = 'owned-child') {
    const expected = canonical(executable);
    const handle = spawn(executable, args, options);
    // Record the returned handle synchronously before logging, awaiting spawn, or reading /proc.
    const record = { role, handle, pid: handle.pid, expected, owner: null, exited: false, neverSpawned: false, exitCode: null, signal: null };
    records.push(record);
    handle.on('exit', (code, signal) => { record.exited = true; record.exitCode = code; record.signal = signal; publishEvent(); });
    const spawned = new Promise((resolve, reject) => {
      handle.once('spawn', resolve);
      handle.on('error', error => {
        if (!Number.isInteger(handle.pid)) record.neverSpawned = true;
        // A handle error remains fatal after the spawn promise has already resolved.
        // It is never proof of exit and does not discard registered ownership.
        onFailure(Error('website_owned_child_handle_error'));
        publishEvent(); reject(error);
      });
    });
    record.registration = spawned.then(() => {
      assert.ok(!record.registrationClosed, 'website_registration_window_closed');
      assert.ok(!record.exited && Number.isInteger(record.pid), 'website_child_exited_before_registration');
      const row = snapshot(record.pid);
      assert.ok(row.pid === record.pid && row.group === record.pid && row.executable === expected && row.state !== 'Z', 'website_child_registration_failed');
      record.owner = row; publish();
    });
    // Cleanup may race a cancelled launch; keep its bounded registration result available.
    record.registration.catch(() => {});
    observe(handle);
    publish(); // Pending PID is durable before awaiting registration or progressing launch.
    await record.registration;
    return record;
  }
  async function cleanup() {
    const errors = [];
    // Close the fixed proxy before waiting on capture/browser cleanup. The signal
    // crosses a process boundary; identity/exit checks remain mandatory.
    const reversed = [...records].reverse();
    const ordered = [...reversed.filter(record => record.role === 'proxy'), ...reversed.filter(record => record.role !== 'proxy')];
    for (const record of ordered) {
      try {
        let timer;
        try {
          await Promise.race([record.registration.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, registrationTimeout); })]);
        } finally { clearTimeout(timer); record.registrationClosed = true; }
        if (record.owner) await stopGroup(record.owner);
        await waitExit(record);
        // A failed /proc registration never grants signalling authority. An exit event alone
        // also cannot prove detached descendants are gone; require the group to be empty.
        assert.ok(record.neverSpawned || record.exited, 'website_pending_child_unresolved');
        if (!record.neverSpawned) assert.equal(groupMembers(record.pid).length, 0, 'website_child_group_not_empty');
      } catch (error) { errors.push(String(error.message)); }
    }
    if (journalFailed) errors.push('website_ledger_persistence_failed');
    return errors;
  }
  return { launch, cleanup, records, report, owners: () => records.flatMap(record => record.owner ? [record.owner] : []) };
}
module.exports = { createLedger };

// Cancellation wakes ordinary work, but is deliberately not passed into identity cleanup.
// Repeated signals record the first signal and failure without bypassing that cleanup.
function createCoordinator({ signals = process, duration = 300000 } = {}) {
  let failure = null, signal = null, disposed = false;
  const waits = new Set();
  const deadlineAt = Date.now() + duration;
  function cancel(error, receivedSignal = null) {
    if (receivedSignal && !signal) signal = receivedSignal;
    if (!failure) failure = error;
    for (const reject of [...waits]) reject(failure);
  }
  const handlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map(name => [name, () => cancel(Error(`website_coordinator_${name}`), name)]));
  for (const [name, handler] of Object.entries(handlers)) signals.on(name, handler);
  const timer = setTimeout(() => cancel(Error('website_coordinator_deadline')), duration);
  function check() {
    if (disposed) throw Error('website_coordinator_disposed');
    if (Date.now() >= deadlineAt && !failure) cancel(Error('website_coordinator_deadline'));
    if (failure) throw failure;
  }
  function run(start) {
    return new Promise((resolve, reject) => {
      try { check(); } catch (error) { reject(error); return; }
      let settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; waits.delete(abort); if (error) reject(error); else resolve(value); };
      const abort = error => finish(error);
      waits.add(abort);
      // Even if cancellation wins, observe the underlying promise; the ledger still owns it.
      try { Promise.resolve(start()).then(value => { try { check(); finish(null, value); } catch (error) { finish(error); } }, error => finish(error)); } catch (error) { finish(error); }
    });
  }
  function report() { return { interrupted: Boolean(signal), signal, failure: failure?.message ?? null }; }
  function dispose() { disposed = true; clearTimeout(timer); for (const [name, handler] of Object.entries(handlers)) signals.removeListener(name, handler); }
  return { run, check, cancel, report, dispose };
}
module.exports.createCoordinator = createCoordinator;

function observeOwnedChild(child, { critical, isCleaning, onFailure, onData }) {
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    stream.on('data', onData);
    stream.on('error', () => onFailure(Error('website_owned_child_stream_error')));
  }
  child.on('exit', () => { if (critical && !isCleaning()) onFailure(Error('website_critical_child_exited')); });
}
function persistLedger(directory, nonce, records, io = fs) {
  assert.match(directory, /^\/tmp\/axiom-website-[A-Za-z0-9]+$/);
  assert.match(nonce, /^[a-f0-9]{32}$/);
  assert.ok(records.length <= 4, 'website_ledger_child_bound');
  const contents = JSON.stringify({ schema: 1, nonce, children: records });
  assert.ok(Buffer.byteLength(contents) <= 65536, 'website_ledger_byte_bound');
  const temporary = join(directory, 'ledger.pending.json');
  io.writeFileSync(temporary, contents, { mode: 0o600, flush: true });
  io.renameSync(temporary, join(directory, 'ledger.json'));
}
module.exports.observeOwnedChild = observeOwnedChild;
module.exports.persistLedger = persistLedger;
