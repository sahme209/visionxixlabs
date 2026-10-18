/* eslint-disable @typescript-eslint/no-require-imports -- Owned fixture process ledger with injectable boundaries. */
'use strict';
const assert = require('node:assert/strict');
function createLedger({ spawn, snapshot, canonical, stopGroup, groupMembers, waitExit = async record => {
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
    observe(handle);
    await spawned;
    assert.ok(!record.exited && Number.isInteger(record.pid), 'website_child_exited_before_registration');
    const row = snapshot(record.pid);
    assert.ok(row.pid === record.pid && row.group === record.pid && row.executable === expected && row.state !== 'Z', 'website_child_registration_failed');
    record.owner = row;
    return record;
  }
  async function cleanup() {
    const errors = [];
    for (const record of [...records].reverse()) {
      try {
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
