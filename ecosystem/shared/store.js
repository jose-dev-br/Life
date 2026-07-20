(function (global) {
  const STORAGE_KEY = 'life.auth.v1';

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  }

  function normalizeAuth(data) {
    return {
      token: data && data.token ? data.token : '',
      couple: data && data.couple ? data.couple : '',
      user: data && data.user ? data.user : ''
    };
  }

  function getProfiles() {
    const store = readStore();
    return Array.isArray(store.profiles) ? store.profiles : [];
  }

  global.LifeStore = {
    getAuth: () => normalizeAuth(readStore().current || {}),
    getProfiles,
    saveAuth: ({ token, couple, user }) => {
      const current = normalizeAuth({ token, couple, user });
      const store = readStore();
      const profiles = getProfiles().filter((p) => !(p.user === current.user && p.couple === current.couple));
      profiles.push(current);
      store.current = current;
      store.profiles = profiles.slice(-4);
      writeStore(store);
    },
    clearAuth: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }
  };
})(window);
