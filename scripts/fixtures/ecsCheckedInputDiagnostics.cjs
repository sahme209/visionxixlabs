/* eslint-disable @typescript-eslint/no-require-imports -- private fixture-only synchronous fatal diagnostics */
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const stages = new Set(['initializing', 'validating_source', 'owned_container_startup', 'wire_startup', 'database_preflight', 'schema_bootstrap', 'child_startup', 'child_running', 'receipt_validation', 'receipt_frame', 'receipt_parse', 'receipt_kind', 'receipt_source', 'receipt_wait_close', 'receipt_delivery', 'source_validation', 'wire_validation', 'completed', 'guard_installing', 'guard_installed', 'source_graph_scan', 'guarded_ready', 'prisma_import', 'owned_db_identity', 'source_imports', 'synthetic_seed', 'principal_resolution', 'source_case', 'final_checks', 'disconnect']);
const cleanupStates = new Set(['unobserved', 'not_created', 'pending', 'verified', 'unverified']);
const operations = ['GithubToken', 'Repository', 'Run', 'RunAttempt', 'Workflow', 'Attestations', 'Bundle', 'AssumeRole', 'GetCallerIdentity', 'DescribeServices', 'DescribeTaskDefinition', 'DescribeImages', 'DescribeServicesFinal'];
const counters = [...operations.map(operation => 'wire' + operation), 'caseIndex', 'completedGroups', 'guardDenied', 'mappedRequests', 'wireRequests', 'guardProcesses', 'pendingResponses'];
const cleanupKeys = ['cleanupChild', 'cleanupWire', 'cleanupContainer', 'cleanupDatabase'];
function data(object, key) { try { return Object.getOwnPropertyDescriptor(object, key)?.value; } catch { return undefined; } }
function classification(error) {
  const name = data(error, 'name'), code = data(error, 'code');
  if (name === 'AssertionError' || code === 'ERR_ASSERTION') return 'assertion';
  if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') return 'module_unavailable';
  if (code === 'EPERM' || code === 'EACCES') return 'permission_denied';
  if (name === 'AbortError' || name === 'TimeoutError' || code === 'ETIMEDOUT' || code === 'ABORT_ERR') return 'timeout_or_abort';
  if (['PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientInitializationError', 'PrismaClientValidationError', 'PrismaClientRustPanicError'].includes(name)) return 'prisma_client_error';
  // Exact fixture literals only; never serialize or inspect arbitrary message content.
  const message = data(error, 'message');
  if (message === 'owned_ecs_guard_denied' || message === 'owned_ecs_egress_denied') return 'guard_denied';
  if (message === 'owned_ecs_source_probe_failed') return 'child_exit_nonzero';
  if (message === 'owned_local_auth_http_cleanup_unverified' || message === 'owned_ecs_child_cleanup_unverified' || message === 'owned_ecs_child_cleanup_failed') return 'cleanup_unverified';
  return 'unknown';
}
function directoryIdentity(directory) {
  const base = fs.realpathSync(os.tmpdir());
  if (typeof directory !== 'string' || path.dirname(directory) !== base || !/^axiom-ecs-private-[a-f0-9]{24}$/.test(path.basename(directory))) throw new Error('private_directory_required');
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) throw new Error('private_directory_required');
  return stat;
}
function createDiagnostics(role, sourceCommit, suppliedDirectory) {
  const record = { schema: 'owned_ecs_private_diagnostics_v1', role: role === 'child' ? 'child' : 'owner', sourceCommit: typeof sourceCommit === 'string' && /^[a-f0-9]{40}$/.test(sourceCommit) ? sourceCommit : null, stage: 'initializing', failureStage: null, outcome: 'running', classification: null, wireViolation: null };
  for (const key of counters) record[key] = null;
  for (const key of cleanupKeys) record[key] = 'unobserved';
  let directory = null, identity;
  try {
    if (role !== 'owner' && role !== 'child') throw new Error('private_role_required');
    if (role === 'owner' && suppliedDirectory === undefined) { directory = path.join(fs.realpathSync(os.tmpdir()), 'axiom-ecs-private-' + crypto.randomBytes(12).toString('hex')); fs.mkdirSync(directory, { mode: 0o700 }); fs.chmodSync(directory, 0o700); }
    else directory = suppliedDirectory;
    identity = directoryIdentity(directory);
  } catch { directory = null; }
  function update(values) {
    try {
      const stage = data(values, 'stage'); if (stages.has(stage)) record.stage = stage;
      const outcome = data(values, 'outcome'); if (record.outcome !== 'failed' && ['running', 'completed'].includes(outcome)) record.outcome = outcome;
      for (const key of counters) { const value = data(values, key); if (Number.isInteger(value) && value >= 0) record[key] = Math.min(1_000_000, value); }
      for (const key of cleanupKeys) { const value = data(values, key); if (cleanupStates.has(value)) record[key] = value; }
    } catch { /* Diagnostics never alter the observed operation. */ }
  }
  function fail(error) { if (record.outcome !== 'failed') { record.failureStage = record.stage; record.classification = classification(error); } record.outcome = 'failed'; }
  function write() {
    let temporary, fd;
    try {
      if (!directory) return false;
      const current = directoryIdentity(directory); if (current.dev !== identity.dev || current.ino !== identity.ino) return false;
      const target = path.join(directory, record.role + '.json');
      try { const existing = fs.lstatSync(target); if (!existing.isFile() || existing.isSymbolicLink() || existing.uid !== process.getuid() || existing.nlink !== 1 || (existing.mode & 0o777) !== 0o600) return false; } catch (error) { if (data(error, 'code') !== 'ENOENT') return false; }
      const bytes = JSON.stringify(record); if (Buffer.byteLength(bytes) > 8192) return false;
      temporary = path.join(directory, '.' + record.role + '-' + crypto.randomBytes(12).toString('hex'));
      fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); fs.fchmodSync(fd, 0o600);
      fs.writeFileSync(fd, bytes); fs.closeSync(fd); fd = undefined;
      const final = directoryIdentity(directory); if (final.dev !== identity.dev || final.ino !== identity.ino) return false;
      fs.renameSync(temporary, target); temporary = undefined; return true;
    } catch { return false; }
    finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* best effort, never replace fatal */ } } if (temporary) { try { fs.unlinkSync(temporary); } catch { /* best effort */ } } }
  }
  function wireSummary(summary) {
    try {
      const requests = data(summary, 'requests');
      if (Array.isArray(requests)) {
        const length = data(requests, 'length');
        if (Number.isSafeInteger(length) && length >= 0) {
          record.wireRequests = Math.min(1_000_000, length);
          for (const operation of operations) record['wire' + operation] = 0;
          for (let i = 0; i < Math.min(length, 1_000_000); i++) { const value = data(requests, String(i)); if (typeof value === 'string' && operations.includes(value)) record['wire' + value]++; }
        }
      }
      update({ guardProcesses: data(summary, 'guardProcesses'), pendingResponses: data(summary, 'pendingResponses') });
      const violation = data(summary, 'violation'); if (typeof violation === 'boolean') record.wireViolation = violation;
    } catch { /* Observation only. */ }
  }
  function containerFailure(error) { try { record.cleanupContainer = data(error, 'message') === 'owned_local_auth_http_cleanup_unverified' ? 'unverified' : 'unobserved'; } catch { /* Observation only. */ } }
  return Object.freeze({ directory, update, fail, write, wireSummary, containerFailure, bindSource: value => { if (record.sourceCommit === null && typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)) record.sourceCommit = value; }, snapshot: () => ({ ...record }) });
}
function fatalObserver(recorder, guardReport) {
  return error => {
    try { recorder.fail(error); } catch { /* Preserve the original fatal even if observation fails. */ }
    try { if (guardReport) { const report = guardReport(); recorder.update({ guardDenied: data(report, 'denied'), mappedRequests: data(report, 'mappedRequests') }); } } catch { /* A failed counter read must not prevent the stage snapshot. */ }
    try { recorder.write(); } catch { /* Never throw from uncaughtExceptionMonitor or suppress Node's original fatal. */ }
  };
}
module.exports = { createDiagnostics, fatalObserver };
