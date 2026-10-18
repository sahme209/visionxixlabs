/* eslint-disable @typescript-eslint/no-require-imports -- Owned fixture process ledger with injectable boundaries. */
'use strict';
const assert = require('node:assert/strict');
function createLedger({ spawn, snapshot, canonical, stopGroup, groupMembers, registrationTimeout = 2000, waitExit = async record => {
  const deadline = Date.now() + 2000;
  while (!record.exited && !record.neverSpawned && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
} }) {
  const records = [];
  async function launch(executable, args, options, observe = () => {}) {
    const expected = canonical(executable);
    const handle = spawn(executable, args, options);
    // Record the returned handle synchronously before logging, awaiting spawn, or reading /proc.
    const record = { handle, pid: handle.pid, expected, owner: null, exited: false, neverSpawned: false, exitCode: null, signal: null };
    records.push(record);
    handle.on('exit', (code, signal) => { record.exited = true; record.exitCode = code; record.signal = signal; });
    const spawned = new Promise((resolve, reject) => {
      handle.once('spawn', resolve);
      handle.on('error', error => { if (!Number.isInteger(handle.pid)) record.neverSpawned = true; reject(error); });
    });
    record.registration = spawned.then(() => {
      assert.ok(!record.registrationClosed, 'website_registration_window_closed');
      assert.ok(!record.exited && Number.isInteger(record.pid), 'website_child_exited_before_registration');
      const row = snapshot(record.pid);
      assert.ok(row.pid === record.pid && row.group === record.pid && row.executable === expected && row.state !== 'Z', 'website_child_registration_failed');
      record.owner = row;
    });
    // Cleanup may race a cancelled launch; keep its bounded registration result available.
    record.registration.catch(() => {});
    observe(handle);
    await record.registration;
    return record;
  }
  async function cleanup() {
    const errors = [];
    for (const record of [...records].reverse()) {
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
    return errors;
  }
  return { launch, cleanup, records, owners: () => records.flatMap(record => record.owner ? [record.owner] : []) };
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
