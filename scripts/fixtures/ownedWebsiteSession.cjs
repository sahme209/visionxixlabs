'use strict';
// Absolute driver lifetime covers setup, HTTP, WebSocket and every action. No transport here.
function createSession({ duration = 120000 } = {}) {
  let failure = null;
  const deadlineAt = Date.now() + duration;
  const cancellations = new Set(), finalizers = new Set();
  const deadline = setTimeout(() => stop(Error('website_driver_deadline')), duration);
  function assertActive() { if (!failure && Date.now() >= deadlineAt) stop(Error('website_driver_deadline')); if (failure) throw failure; }
  function stop(error = Error('website_driver_closed')) {
    if (failure) return;
    failure = error; clearTimeout(deadline);
    for (const cancel of [...cancellations]) cancel(error);
    cancellations.clear();
    for (const finalize of [...finalizers]) { try { finalize(); } catch { /* cancellation still fails closed */ } }
    finalizers.clear();
  }
  function onStop(fn) { if (failure) fn(); else finalizers.add(fn); }
  function operation(start, timeout = 15000) {
    return new Promise((resolve, reject) => {
      try { assertActive(); } catch (error) { reject(error); return; }
      let settled = false, timer;
      const cleanups = [];
      const finish = (error, value) => {
        if (settled) return; settled = true;
        clearTimeout(timer); cancellations.delete(cancel);
        for (const cleanup of cleanups) { try { cleanup(); } catch { /* best effort release after rejection */ } }
        if (error) reject(error); else resolve(value);
      };
      const cancel = error => finish(error);
      cancellations.add(cancel);
      timer = setTimeout(() => finish(Error('website_driver_operation_timeout')), timeout);
      try { start(value => finish(null, value), error => finish(error), fn => cleanups.push(fn)); } catch (error) { finish(error); }
    });
  }
  function sleep(ms) { return operation((resolve, _reject, onCancel) => { const timer = setTimeout(resolve, ms); onCancel(() => clearTimeout(timer)); }, ms + 1000); }
  return { assertActive, stop, onStop, operation, sleep };
}
module.exports = { createSession };
async function openChannel({ session, endpoint, createSocket, proveEndpoint, onEvent = () => {}, openState = 1 }) {
  session.assertActive(); proveEndpoint();
  const socket = createSocket(endpoint);
  session.onStop(() => socket.close());
  socket.addEventListener('close', () => session.stop(Error('website_cdp_closed')));
  socket.addEventListener('error', () => session.stop(Error('website_cdp_error')));
  await session.operation((resolve, reject, onCancel) => {
    const opened = () => { try { proveEndpoint(); resolve(); } catch (error) { reject(error); } };
    socket.addEventListener('open', opened, { once: true }); onCancel(() => socket.removeEventListener('open', opened));
  });
  let sequence = 0;
  const pending = new Map();
  function send(method, params = {}) {
    return session.operation((resolve, reject, onCancel) => {
      proveEndpoint();
      if (socket.readyState !== openState) throw Error('website_cdp_not_open');
      const id = ++sequence; pending.set(id, { resolve, reject }); onCancel(() => pending.delete(id));
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  socket.addEventListener('message', event => {
    try { session.assertActive(); } catch { return; }
    let data; try { data = JSON.parse(event.data); } catch { session.stop(Error('website_cdp_invalid_message')); return; }
    if (data.id) { const task = pending.get(data.id); if (!task) return; if (data.error) task.reject(Error(`website_cdp_protocol:${data.error.code}`)); else task.resolve(data.result); return; }
    try { onEvent(data, send); } catch (error) { session.stop(error); }
  });
  return { send };
}
module.exports.openChannel = openChannel;
