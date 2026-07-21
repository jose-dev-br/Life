const { useEffect, useState } = React;

function LoginPage() {
  const [tela, setTela] = useState('inicio');
  const [codigo, setCodigo] = useState('');
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [codes, setCodes] = useState([]);

  useEffect(() => {
    if (LifeStore.getAuth().token) {
      window.location.href = '/hub.html';
    }
  }, []);

  function irPara(t) { setErro(''); setTela(t); }

  function guardarAuth(data) {
    LifeStore.saveAuth({ token: data.token, couple: codigoDigitado || codigo, user: usuario });
  }

  async function esqueciCodigo() {
    const nome = LifeSecurity.normalizeUser(usuario);
    if (!nome) { setErro('Digite seu nome de usuário'); return; }
    setErro(''); setCarregando(true);
    try {
      const data = await LifeAPI.couple.lookup(nome);
      setCarregando(false);
      if (data.error) { setErro(data.error); return; }
      setCodes(data.codes || []);
      irPara('esqueciCodigo');
    } catch (e) {
      setErro(e.message || 'Erro de conexão'); setCarregando(false);
    }
  }

  async function criarCasal() {
    setErro(''); setCarregando(true);
    try {
      const data = await LifeAPI.auth.createCouple();
      setCodigo(data.code); setCodigoDigitado(data.code); setCarregando(false); irPara('criar');
    } catch (e) {
      setErro(e.message || 'Erro de conexão'); setCarregando(false);
    }
  }

  async function registrar() {
    const nome = LifeSecurity.normalizeUser(usuario);
    const code = LifeSecurity.normalizeCoupleCode(codigoDigitado || codigo);
    if (!nome || !LifeSecurity.validatePassword(senha)) { setErro('Usuário e senha com 4+ caracteres'); return; }
    setErro(''); setCarregando(true);
    try {
      const data = await LifeAPI.auth.register({ couple: code, usuario: nome, senha });
      guardarAuth(data);
      setCarregando(false);
      irPara('sucesso');
    } catch (e) {
      setErro(e.message || 'Erro de conexão'); setCarregando(false);
    }
  }

  async function entrar() {
    const nome = LifeSecurity.normalizeUser(usuario);
    const code = LifeSecurity.normalizeCoupleCode(codigoDigitado || codigo);
    if (!nome || !senha) { setErro('Preencha usuário e senha'); return; }
    setErro(''); setCarregando(true);
    try {
      const data = await LifeAPI.auth.login({ couple: code, usuario: nome, senha });
      guardarAuth(data);
      setCarregando(false);
      irPara('sucesso');
    } catch (e) {
      setErro(e.message || 'Erro de conexão'); setCarregando(false);
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .lg-root { font-family: 'Nunito', sans-serif; }
        .lg-serif { font-family: 'Fraunces', serif; }
        .lg-mono { font-family: 'JetBrains Mono', monospace; }
        .lg-card { background:#fffdfc; border-radius:20px; border:1.5px solid #f0ddd6; box-shadow:0 2px 12px rgba(180,120,110,0.07); }
        .lg-btn-primary { border:none; background:#a8544a; color:white; font-weight:800; border-radius:14px; padding:13px; font-size:14.5px; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
        .lg-btn-outline { border:1.5px solid #f0ddd6; background:#fffdfc; color:#4a3634; font-weight:800; border-radius:14px; padding:13px; font-size:14.5px; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; }
        .lg-input { width:100%; border:1.5px solid #f0ddd6; border-radius:12px; padding:12px 14px; font-family:'Nunito',sans-serif; font-size:14px; color:#4a3634; outline:none; }
        .lg-input:focus { border-color:#a8544a; }
        .lg-input.codigo { text-align:center; letter-spacing:6px; font-family:'JetBrains Mono',monospace; font-size:20px; font-weight:800; text-transform:uppercase; }
        .lg-label { font-size:11.5px; font-weight:700; color:#8a6f6a; margin-bottom:5px; display:block; }
        .lg-back { font-size:13px; color:#a8938e; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; background:none; border:none; padding:0; font-family:inherit; }
        .lg-error { font-size:12.5px; color:#c94a3f; background:#fbe7e5; border-radius:10px; padding:8px 12px; text-align:center; }
        .lg-check { width:70px; height:70px; border-radius:50%; background:#7fb88f; display:flex; align-items:center; justify-content:center; font-size:34px; color:white; margin:0 auto 16px; }
      `}</style>
      <div className="lg-root" style={styles.container}>
        <div className="lg-serif" style={{ fontSize: 24, fontWeight: 600, color: '#4a3634', textAlign: 'center' }}>Jornada do Casal</div>
        {tela === 'inicio' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <div style={{ fontSize: 13.5, color: '#6b5450', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>Entre na sua conta ou crie um novo casal.</div>
            <button className="lg-btn-primary" onClick={() => irPara('entrar')}>Entrar na minha conta</button>
            <div style={{ height: 10 }} />
            <button className="lg-btn-outline" onClick={() => irPara('entrarCodigo')}>Já tenho um código</button>
            <div style={{ height: 10 }} />
            <button className="lg-btn-outline" onClick={criarCasal} disabled={carregando}>{carregando ? 'Criando...' : 'Criar novo casal'}</button>
            <div style={{ height: 14 }} />
            <button className="lg-btn-outline" onClick={() => irPara('esqueciInput')} style={{ fontSize: 12.5, color: '#a8938e', borderStyle: 'dashed' }}>Esqueci meu código</button>
          </div>
        )}
        {tela === 'esqueciInput' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <button className="lg-back" onClick={() => irPara('inicio')}>← voltar</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4a3634', marginTop: 14, marginBottom: 14 }}>Esqueci meu código</div>
            <label className="lg-label">Usuário</label>
            <input className="lg-input" placeholder="seu nome" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={esqueciCodigo} disabled={carregando}>{carregando ? 'Buscando...' : 'Buscar código'}</button>
          </div>
        )}
        {tela === 'esqueciCodigo' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <button className="lg-back" onClick={() => irPara('esqueciInput')}>← voltar</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4a3634', marginTop: 14, marginBottom: 14 }}>Seus códigos</div>
            {codes.map((c) => (
              <button key={c} className="lg-btn-outline" style={{ marginBottom: 10 }} onClick={() => { setCodigoDigitado(c); irPara('entrar'); }}>{c}</button>
            ))}
          </div>
        )}
        {tela === 'entrar' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <button className="lg-back" onClick={() => irPara('inicio')}>← voltar</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4a3634', marginTop: 14, marginBottom: 14 }}>Entrar na conta</div>
            <label className="lg-label">Código do casal</label>
            <input className="lg-input codigo" maxLength={6} placeholder="XXXXXX" value={codigoDigitado} onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())} style={{ marginBottom: 12 }} />
            <label className="lg-label">Usuário</label>
            <input className="lg-input" placeholder="seu nome" value={usuario} onChange={(e) => setUsuario(e.target.value)} style={{ marginBottom: 10 }} />
            <label className="lg-label">Senha</label>
            <input className="lg-input" type="password" placeholder="sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={entrar} disabled={carregando}>{carregando ? 'Entrando...' : 'Entrar'}</button>
          </div>
        )}
        {tela === 'criar' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <button className="lg-back" onClick={() => irPara('inicio')}>← voltar</button>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#4a3634', marginTop: 14, marginBottom: 10 }}>Esse é o código do seu casal</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: '#a8544a', textAlign: 'center' }}>{codigo}</div>
            <div style={{ fontSize: 11.5, color: '#a8938e', textAlign: 'center', marginTop: 10 }}>Guarde ou compartilhe com seu par.</div>
            <div style={{ height: 18 }} />
            <label className="lg-label">Usuário</label>
            <input className="lg-input" placeholder="ex: jose" value={usuario} onChange={(e) => setUsuario(e.target.value)} style={{ marginBottom: 10 }} />
            <label className="lg-label">Senha</label>
            <input className="lg-input" type="password" placeholder="mín. 4 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={registrar} disabled={carregando}>{carregando ? 'Criando...' : 'Criar conta e entrar'}</button>
          </div>
        )}
        {tela === 'entrarCodigo' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <button className="lg-back" onClick={() => irPara('inicio')}>← voltar</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4a3634', marginTop: 14, marginBottom: 12 }}>Digite o código do casal</div>
            <input className="lg-input codigo" maxLength={6} placeholder="XXXXXX" value={codigoDigitado} onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={() => { setCodigo(codigoDigitado); irPara('registrar'); }}>Continuar</button>
          </div>
        )}
        {tela === 'registrar' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <button className="lg-back" onClick={() => irPara('entrarCodigo')}>← voltar</button>
            <div style={{ fontSize: 12, color: '#a8938e', marginTop: 14, marginBottom: 4 }}>Casal</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#a8544a', marginBottom: 16, letterSpacing: 2 }}>{codigoDigitado}</div>
            <label className="lg-label">Usuário</label>
            <input className="lg-input" placeholder="ex: jose" value={usuario} onChange={(e) => setUsuario(e.target.value)} style={{ marginBottom: 10 }} />
            <label className="lg-label">Senha</label>
            <input className="lg-input" type="password" placeholder="mín. 4 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={registrar} disabled={carregando}>{carregando ? 'Criando...' : 'Criar conta e entrar'}</button>
          </div>
        )}
        {tela === 'sucesso' && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20, textAlign: 'center' }}>
            <div className="lg-check">✓</div>
            <div className="lg-serif" style={{ fontSize: 18, fontWeight: 600, color: '#4a3634' }}>Conectado!</div>
            <div style={{ fontSize: 13, color: '#6b5450', marginTop: 6 }}>Bem-vindo(a) de volta, {usuario || 'parceiro(a)'}.</div>
            <a href="/hub.html" style={{ textDecoration: 'none' }}><button className="lg-btn-primary" style={{ marginTop: 18 }}>Entrar no app</button></a>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = { page: { minHeight: '100vh', background: '#faf1ee', padding: '40px 14px 40px', display: 'flex', justifyContent: 'center' }, container: { width: '100%', maxWidth: 380 } };

ReactDOM.createRoot(document.getElementById('root')).render(<LoginPage />);
