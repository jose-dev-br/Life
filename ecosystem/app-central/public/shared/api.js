(function (global) {
  const API_BASE = '/api';

  function authHeaders() {
    const token = sessionStorage.getItem('jwt') || '';
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  }

  async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro de conexão');
    }
    return data;
  }

  async function requestWithSync(path, eventType, payload, options = {}) {
    if (typeof LifeSync !== 'undefined' && navigator.onLine) {
      try {
        const result = await request(path, options);
        if (result.ok) {
          LifeSync.emit(eventType, payload);
        }
        return result;
      } catch (e) {
        LifeSync.emit(eventType, payload);
        return { ok: true, queued: true };
      }
    } else if (typeof LifeSync !== 'undefined') {
      LifeSync.emit(eventType, payload);
      return { ok: true, queued: true };
    }
    return request(path, options);
  }

  global.LifeAPI = {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
    postWithSync: (path, eventType, payload) => requestWithSync(path, eventType, payload, { method: 'POST', body: JSON.stringify(payload || {}) }),
    auth: {
      me: () => global.LifeAPI.get('/auth/me'),
      login: (payload) => global.LifeAPI.post('/auth/login', payload),
      register: (payload) => global.LifeAPI.post('/auth/register', payload),
      createCouple: () => global.LifeAPI.post('/couple/create')
    },
    couple: {
      lookup: (user) => global.LifeAPI.get(`/couple/lookup?user=${encodeURIComponent(user)}`),
      users: () => global.LifeAPI.get('/couple/users')
    },
    diary: {
      createQuiz: (payload) => global.LifeAPI.post('/diary/quiz/create', payload),
      todayQuiz: () => global.LifeAPI.get('/diary/quiz/today'),
      historyQuiz: () => global.LifeAPI.get('/diary/quiz/history'),
      answerQuiz: (payload) => global.LifeAPI.postWithSync('/diary/quiz/answer', 'diary.quiz.answered', payload),
      sendLetter: (payload) => global.LifeAPI.postWithSync('/diary/letter', 'diary.letter.sent', payload),
      moodLog: (payload) => global.LifeAPI.postWithSync('/diary/mood', 'diary.mood.logged', payload),
      moodToday: () => global.LifeAPI.get('/diary/mood/today'),
      moodList: () => global.LifeAPI.get('/diary/mood'),
      stats: () => global.LifeAPI.get('/diary/stats')
    },
    uber: {
      getSettings: () => global.LifeAPI.get('/uber/settings'),
      saveSettings: (payload) => global.LifeAPI.postWithSync('/uber/settings', 'uber.settings.updated', payload),
      getSessions: () => global.LifeAPI.get('/uber/sessions'),
      saveSession: (payload) => global.LifeAPI.postWithSync('/uber/sessions', 'uber.session.saved', payload),
      getOverrides: () => global.LifeAPI.get('/uber/overrides'),
      saveOverride: (payload) => global.LifeAPI.postWithSync('/uber/overrides', 'uber.override.updated', payload)
    }
  };
})(window);
