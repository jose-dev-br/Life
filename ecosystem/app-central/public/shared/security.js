(function (global) {
  function safeText(value) {
    return String(value || '').trim();
  }

  global.LifeSecurity = {
    normalizeUser: (value) => safeText(value).toLowerCase(),
    normalizeCoupleCode: (value) => safeText(value).toUpperCase(),
    validatePassword: (value) => safeText(value).length >= 4,
    validateUsername: (value) => /^[a-zA-Z0-9_.-]{2,32}$/.test(safeText(value))
  };
})(window);
