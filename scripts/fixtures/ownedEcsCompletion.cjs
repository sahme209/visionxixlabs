'use strict';
const MAX_BYTES = 128 * 1024;
const reasons = new Set(['protocol', 'terminal_message', 'frame', 'sequence', 'pending_controls', 'byte_limit', 'json', 'kind', 'source', 'close_required', 'missing', 'exit', 'owner_aborted', 'send_failed', 'send_throw', 'send_callback', 'send_timeout', 'ack', 'disconnected', 'close_timeout']);
const errorFor = reason => new Error('owned_ecs_completion_' + (reasons.has(reason) ? reason : 'protocol'));
const data = (object, key) => { try { return Object.getOwnPropertyDescriptor(object, key)?.value; } catch { return undefined; } };
function exact(object, keys) { try { return object !== null && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key)); } catch { return false; } }
function createCompletionReceiver({ proof, sourceCommit }) {
  let fatal, candidate, bytes = 0, exited = false, exitCode, exitSignal, closed = false, stage = 'receipt_frame';
  function fail(reason) { if (!fatal) fatal = errorFor(reason); throw fatal; }
  function assertHealthy() { if (fatal) throw fatal; }
  function assertCanReceive() { assertHealthy(); if (candidate || closed) fail('terminal_message'); }
  function observeBytes(count) { assertHealthy(); if (!Number.isSafeInteger(count) || count < 0 || count > MAX_BYTES - bytes) fail('byte_limit'); bytes += count; }
  function accept(message, expectedId, pendingControls = 0) {
    assertCanReceive(); stage = 'receipt_frame';
    if (!exact(message, ['kind', 'proof', 'id', 'command', 'sourceCommit', 'receiptJson']) || data(message, 'kind') !== 'owned_ecs_control' || data(message, 'command') !== 'complete' || data(message, 'proof') !== proof || data(message, 'sourceCommit') !== sourceCommit || typeof proof !== 'string' || typeof sourceCommit !== 'string' || !/^[a-f0-9]{32}$/.test(proof) || !/^[a-f0-9]{40}$/.test(sourceCommit)) fail('frame');
    if (!Number.isSafeInteger(expectedId) || expectedId < 1 || data(message, 'id') !== expectedId) fail('sequence');
    if (pendingControls !== 0) fail('pending_controls');
    const text = data(message, 'receiptJson'); if (typeof text !== 'string') fail('frame'); observeBytes(Buffer.byteLength(text));
    stage = 'receipt_parse'; let parsed; try { parsed = JSON.parse(text); } catch { fail('json'); }
    stage = 'receipt_kind'; if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.kind !== 'owned_ecs_checked_inputs') fail('kind');
    stage = 'receipt_source'; if (parsed.sourceCommit !== sourceCommit) fail('source');
    candidate = parsed; return candidate;
  }
  function result({ aborted = false } = {}) {
    assertHealthy(); if (aborted) fail('owner_aborted'); if (!exited || exitCode !== 0 || exitSignal) fail('exit');
    if (!closed) throw errorFor('close_required'); if (!candidate) fail('missing'); return candidate;
  }
  return Object.freeze({ accept, assertCanReceive, assertHealthy, observeBytes, fail, result, stage: () => stage,
    exit(code, signal) { exited = true; exitCode = code; exitSignal = signal; }, close() { closed = true; } });
}
async function sendCompletion(channel, frame) {
  const proof = data(frame, 'proof'), sourceCommit = data(frame, 'sourceCommit'), id = data(frame, 'id');
  createCompletionReceiver({ proof, sourceCommit }).accept(frame, id);
  await new Promise((resolve, reject) => {
    let callbackDone = false, acknowledged = false, sendReturned = false, settled = false;
    const finish = error => { if (settled || !error && (!callbackDone || !acknowledged || !sendReturned)) return; settled = true; clearTimeout(timer); channel.removeListener('message', onMessage); channel.removeListener('disconnect', onDisconnect); if (error) reject(error); else resolve(); };
    const onMessage = message => {
      if (!exact(message, ['kind', 'proof', 'id', 'sourceCommit', 'ok']) || data(message, 'kind') !== 'owned_ecs_completion_ack' || data(message, 'proof') !== proof || data(message, 'id') !== id || data(message, 'sourceCommit') !== sourceCommit || data(message, 'ok') !== true || acknowledged) { finish(errorFor('ack')); return; }
      acknowledged = true; finish();
    };
    const onDisconnect = () => finish(errorFor('disconnected'));
    const timer = setTimeout(() => finish(errorFor('send_timeout')), 7000);
    channel.on('message', onMessage); channel.on('disconnect', onDisconnect);
    try { channel.send(frame, error => { if (error || callbackDone) { finish(errorFor('send_callback')); return; } callbackDone = true; finish(); }); sendReturned = true; finish(); }
    catch { finish(errorFor('send_throw')); }
  });
}
module.exports = { createCompletionReceiver, sendCompletion };
