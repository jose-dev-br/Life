(function (global) {
  const QUEUE_KEY = 'jornada_sync_queue';
  const LAST_SYNC_KEY = 'jornada_last_sync';
  const DEVICE_KEY = 'jornada_device_id';
  const POLL_INTERVAL = 30000;

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch { return []; }
  }

  function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function addToQueue(item) {
    const queue = getQueue();
    queue.push(item);
    saveQueue(queue);
    scheduleSync();
  }

  function removeByIds(ids) {
    const queue = getQueue().filter(e => !ids.includes(e.id));
    saveQueue(queue);
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function emit(type, payload) {
    const auth = global.LifeStore ? global.LifeStore.getAuth() : {};
    const event = {
      id: generateId(),
      type: type,
      payload: payload || {},
      userId: auth.user || 'unknown',
      deviceId: getDeviceId(),
      createdAt: new Date().toISOString(),
      syncStatus: 'pending'
    };
    addToQueue(event);
    return event;
  }

  let syncTimer = null;
  let syncing = false;

  function scheduleSync() {
    if (syncTimer) return;
    syncTimer = setTimeout(() => {
      syncTimer = null;
      doSync();
    }, 2000);
  }

  async function doSync() {
    if (syncing) return;
    if (!navigator.onLine) return;

    const auth = global.LifeStore ? global.LifeStore.getAuth() : {};
    if (!auth.token || !auth.couple) return;

    const pending = getQueue().filter(e => e.syncStatus === 'pending');
    if (pending.length === 0) {
      await pullRemote();
      return;
    }

    syncing = true;
    try {
      const res = await fetch(`/api/sync?couple=${encodeURIComponent(auth.couple)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ events: pending.map(e => ({
          id: e.id,
          type: e.type,
          payload: e.payload,
          userId: e.userId,
          deviceId: e.deviceId,
          createdAt: e.createdAt
        }))})
      });

      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        removeByIds(pending.map(e => e.id));
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        await pullRemote();
      }
    } catch (e) {
      const queue = getQueue();
      queue.forEach(e => {
        if (pending.find(p => p.id === e.id)) {
          e.syncStatus = 'failed';
        }
      });
      saveQueue(queue);
    } finally {
      syncing = false;
    }
  }

  async function pullRemote() {
    const auth = global.LifeStore ? global.LifeStore.getAuth() : {};
    if (!auth.token || !auth.couple) return;

    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const since = lastSync || '';

    try {
      const url = since
        ? `/api/sync?couple=${encodeURIComponent(auth.couple)}&since=${encodeURIComponent(since)}`
        : `/api/sync?couple=${encodeURIComponent(auth.couple)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.events && data.events.length > 0) {
        const localIds = getQueue().map(e => e.id);
        const remoteNew = data.events.filter(e => !localIds.includes(e.id));
        if (remoteNew.length > 0) {
          applyRemoteEvents(remoteNew);
        }
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      }
    } catch (e) { /* offline, ignore */ }
  }

  function applyRemoteEvents(events) {
    events.forEach(ev => {
      const handler = EVENT_HANDLERS[ev.type];
      if (handler) {
        try { handler(ev.payload, ev); } catch (e) { console.warn('sync handler error', e); }
      }
    });
  }

  const EVENT_HANDLERS = {};

  function on(type, handler) {
    EVENT_HANDLERS[type] = handler;
  }

  function init() {
    if (!navigator.onLine) return;
    scheduleSync();

    window.addEventListener('online', () => {
      const queue = getQueue();
      queue.forEach(e => { e.syncStatus = 'pending'; });
      saveQueue(queue);
      scheduleSync();
    });

    setInterval(() => {
      if (navigator.onLine) scheduleSync();
    }, POLL_INTERVAL);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        scheduleSync();
      }
    });
  }

  global.LifeSync = {
    emit,
    on,
    init,
    doSync,
    getQueue: () => getQueue(),
    getLastSync: () => localStorage.getItem(LAST_SYNC_KEY),
    getPendingCount: () => getQueue().filter(e => e.syncStatus === 'pending').length
  };
})(window);
