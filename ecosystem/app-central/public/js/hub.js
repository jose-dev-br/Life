const { useEffect, useState } = React;

const APPS = [
  { id: 'diario', nome: 'Diário', icone: '📝', cor: '#a8544a', desc: 'Cartas, quiz e humor', link: '/diario/', total: 20 },
  { id: 'uber', nome: 'Uber', icone: '🚗', cor: '#7fb88f', desc: 'Rotina, escala e sessões', link: '/uber/', total: 30 },
  { id: 'jogos', nome: 'Jogos', icone: '🎮', cor: '#a87fd9', desc: 'Jogos em dupla', link: '/jogos/', total: 15 },
  { id: 'saude', nome: 'Saúde', icone: '🏋️', cor: '#e0a24a', desc: 'Peso, ciclo e treino', link: '/saude/', total: 25 },
];

function HubPage() {
  const [entrou, setEntrou] = useState(false);
  const [nomes, setNomes] = useState([]);
  const [stats, setStats] = useState(null);
  const auth = LifeStore.getAuth();
  const user = auth.user || 'parceiro(a)';
  const couple = auth.couple || '------';

  useEffect(() => {
    if (!auth.token) {
      window.location.href = '/';
      return;
    }
    const t = setTimeout(() => setEntrou(true), 60);
    async function load() {
      try {
        const [nu, st] = await Promise.all([LifeAPI.couple.users(), LifeAPI.diary.stats()]);
        if (nu.ok && nu.users) setNomes(nu.users);
        if (st.ok) setStats(st);
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => clearTimeout(t);
  }, [auth.token]);

  const totalConquistas = stats ? stats.quizzes_respondidos + stats.cartas + stats.humores : 0;
  const totalPossivel = APPS.reduce((s, a) => s + a.total, 0);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .hb-root { font-family: 'Nunito', sans-serif; }
        .hb-serif { font-family: 'Fraunces', serif; }
        .hb-mono { font-family: 'JetBrains Mono', monospace; }
        .hb-card { background:#fffdfc; border-radius:20px; border:1.5px solid #f0ddd6; box-shadow:0 2px 12px rgba(180,120,110,0.07); }
        .hb-app-card { padding:18px; border-radius:22px; cursor:pointer; display:flex; align-items:center; gap:14px; text-decoration:none; transition:transform .15s ease; }
        .hb-app-card:active { transform:scale(0.98); }
        .hb-app-icon { width:52px; height:52px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; }
        .hb-bar-track { background:#f5e6e1; border-radius:999px; overflow:hidden; }
        .hb-bar-fill { height:100%; border-radius:999px; }
        .hb-footer { text-align:center; padding:14px; }
        .hb-logout { font-size:12px; color:#a8938e; font-weight:700; cursor:pointer; text-decoration:underline; }
      `}</style>
      <div className="hb-root" style={styles.container}>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div className="hb-serif" style={{ fontSize: 24, fontWeight: 600, color: '#4a3634' }}>Jornada do Casal</div>
          <div style={{ fontSize: 12.5, color: '#a8938e', marginTop: 4 }}>{nomes.length >= 2 ? nomes.join(' & ') : user + ' & parceiro(a)'} · casal {couple}</div>
        </div>
        <div className="hb-card" style={{ padding: 16, textAlign: 'center', opacity: entrou ? 1 : 0, transition: 'opacity .4s ease' }}>
          <div className="hb-mono" style={{ fontSize: 20, fontWeight: 800, color: '#4a3634' }}>{totalConquistas}/{totalPossivel}</div>
          <div style={{ fontSize: 10.5, color: '#a8938e', fontWeight: 700, textTransform: 'uppercase' }}>atividades no ecossistema todo</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {APPS.map((app) => {
            const atual = app.id === 'diario' && stats ? stats.quizzes_respondidos + stats.cartas + stats.humores : 0;
            const pct = stats ? Math.round((atual / app.total) * 100) : 0;
            const label = app.id === 'diario' && stats ? `${stats.quizzes_respondidos} quizzes · ${stats.cartas} cartas · ${stats.humores} humores` : 'ainda sem dados';
            return (
              <a key={app.id} href={app.link} className="hb-card hb-app-card" style={{ opacity: entrou ? 1 : 0 }}>
                <div className="hb-app-icon" style={{ background: app.cor + '22' }}>{app.icone}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div className="hb-serif" style={{ fontSize: 17, fontWeight: 600, color: '#4a3634' }}>{app.nome}</div>
                    {stats && app.id === 'diario' && <span style={{ fontSize: 11, fontWeight: 700, color: app.cor }}>💞 {stats.sintonia}%</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#a8938e', marginTop: 1 }}>{app.desc}</div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#8a6f6a', marginBottom: 3 }}>
                      <span>🎖️ atividades</span>
                      <span className="hb-mono">{atual}/{app.total}</span>
                    </div>
                    <div className="hb-bar-track" style={{ height: 6 }}>
                      <div className="hb-bar-fill" style={{ width: `${pct}%`, background: app.cor }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#c2aca4', marginTop: 6, fontStyle: 'italic' }}>{label}</div>
                </div>
                <span style={{ fontSize: 18, color: '#c2aca4' }}>›</span>
              </a>
            );
          })}
        </div>
        <div className="hb-footer">
          <div style={{ fontSize: 10.5, color: '#c2aca4', marginBottom: 8 }}>Tudo fica sincronizado pelo backend central.</div>
          <a href="/" className="hb-logout" onClick={() => { LifeStore.clearAuth(); }}>sair da conta</a>
        </div>
      </div>
    </div>
  );
}

const styles = { page: { minHeight: '100vh', background: '#faf1ee', padding: '24px 14px 40px', display: 'flex', justifyContent: 'center' }, container: { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 } };

ReactDOM.createRoot(document.getElementById('root')).render(<HubPage />);
