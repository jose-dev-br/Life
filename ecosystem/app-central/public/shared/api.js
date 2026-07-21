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

  global.LifeAPI = {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
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
      answerQuiz: (payload) => global.LifeAPI.post('/diary/quiz/answer', payload),
      sendLetter: (payload) => global.LifeAPI.post('/diary/letter', payload),
      letters: () => global.LifeAPI.get('/diary/letters'),
      moodLog: (payload) => global.LifeAPI.post('/diary/mood', payload),
      moodToday: () => global.LifeAPI.get('/diary/mood/today'),
      moodList: () => global.LifeAPI.get('/diary/mood'),
      stats: () => global.LifeAPI.get('/diary/stats')
    },
    uber: {
      getSettings: () => global.LifeAPI.get('/uber/settings'),
      saveSettings: (payload) => global.LifeAPI.post('/uber/settings', payload),
      getSessions: () => global.LifeAPI.get('/uber/sessions'),
      saveSession: (payload) => global.LifeAPI.post('/uber/sessions', payload),
      getOverrides: () => global.LifeAPI.get('/uber/overrides'),
      saveOverride: (payload) => global.LifeAPI.post('/uber/overrides', payload)
    }
  };
})(window);
