// Optional extension scheduling. Page timers are always retained as fallback.
// Host messages are advisory: ownership, pause and cooldown stay in the runner.
function createBackgroundClock(page, { onWake = () => {} } = {}) {
  const nativeSet = page.setTimeout.bind(page);
  const nativeClear = page.clearTimeout.bind(page);
  const pending = new Map();
  let sequence = 0, disposed = false, lastWakeAt = 0, hostReplies = 0;
  function fire(handle) {
    const record = pending.get(handle);
    if (!record) return;
    pending.delete(handle);
    nativeClear(record.fallback);
    record.callback(...record.args);
  }
  function set(callback, delay = 0, ...args) {
    if (disposed) return 0;
    const ms = Math.max(0, Number(delay) || 0);
    const handle = --sequence;
    const requestId = `clock:${page.crypto.randomUUID()}`;
    const record = { callback, args, requestId, due:Date.now() + ms, fallback:null };
    pending.set(handle, record);
    record.fallback = nativeSet(() => fire(handle), ms);
    if (page.document.hidden && ms <= 20000) {
      try { page.postMessage({ source:'fabushi-userscript', type:'background-clock.request', requestId, payload:{delayMs:ms} }, '*'); } catch { /* Native fallback remains armed. */ }
    }
    return handle;
  }
  function clear(handle) {
    const record = pending.get(handle);
    if (!record) return;
    pending.delete(handle);
    nativeClear(record.fallback);
  }
  function receive(event) {
    if (disposed || event.source !== page || event.data?.source !== 'fabushi-extension') return;
    const message = event.data;
    if (message.type === 'background-clock.response' && message.ok === true) {
      for (const [handle, record] of pending) {
        if (record.requestId !== message.requestId) continue;
        // A host response may arrive before its requested deadline (or be
        // replayed). It must never shorten a cooldown or an approval grace.
        if (Date.now() >= record.due) { hostReplies++; fire(handle); }
        break;
      }
    } else if (message.type === 'background-wake') {
      lastWakeAt = Date.now();
      for (const [handle, record] of [...pending]) {
        if (record.due <= lastWakeAt) fire(handle);
      }
      onWake();
    }
  }
  page.addEventListener('message', receive);
  return {
    setTimeout:set, clearTimeout:clear,
    status:() => ({ pending:pending.size, lastWakeAt, hostReplies }),
    dispose() {
      if (disposed) return;
      disposed = true;
      page.removeEventListener('message', receive);
      for (const handle of [...pending.keys()]) clear(handle);
    },
  };
}
