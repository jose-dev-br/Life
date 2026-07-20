(function (global) {
  function getSession(key) {
    return sessionStorage.getItem(key) || '';
  }

  function setSession(key, value) {
    sessionStorage.setItem(key, value);
  }

  function clearSession() {
    sessionStorage.clear();
  }

  global.LifeStore = {
    getAuth: () => ({
      token: getSession('jwt'),
      couple: getSession('couple'),
      user: getSession('user')
    }),
    saveAuth: ({ token, couple, user }) => {
      setSession('jwt', token || '');
      setSession('couple', couple || '');
      setSession('user', user || '');
    },
    clearAuth: clearSession
  };
})(window);
