import React, { useState } from "react";

function gerarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function LoginMock() {
  const [tela, setTela] = useState("inicio"); // inicio | criar | entrarCodigo | auth | sucesso
  const [codigo] = useState(gerarCodigo());
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [modoAuth, setModoAuth] = useState("login"); // login | registrar
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [tokenDemo, setTokenDemo] = useState(null);

  function irPara(t) {
    setErro("");
    setTela(t);
  }

  function confirmarCodigo() {
    if (codigoDigitado.trim().length !== 6) {
      setErro("O código tem 6 caracteres");
      return;
    }
    setErro("");
    irPara("auth");
  }

  function autenticar() {
    if (!usuario.trim() || senha.length < 4) {
      setErro("Preencha usuário e uma senha com 4+ caracteres");
      return;
    }
    setErro("");
    setCarregando(true);
    setTimeout(() => {
      setCarregando(false);
      setTokenDemo({
        exp: "30 dias",
        payload: `{ "sub": "${usuario}", "couple": "${codigo}" }`,
      });
      irPara("sucesso");
    }, 900);
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        .lg-root { font-family: 'Nunito', sans-serif; }
        .lg-serif { font-family: 'Fraunces', serif; }
        .lg-mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes popIcon { 0%{transform:scale(.6) rotate(-8deg);opacity:0;} 60%{transform:scale(1.12) rotate(3deg);opacity:1;} 100%{transform:scale(1) rotate(0);opacity:1;} }
        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes checkPop { 0%{transform:scale(0);} 60%{transform:scale(1.2);} 100%{transform:scale(1);} }
        @media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms !important; } }

        .lg-card { background:#fffdfc; border-radius:20px; border:1.5px solid #f0ddd6; box-shadow:0 2px 12px rgba(180,120,110,0.07); animation:fadeSlideIn .35s ease; }

        .lg-logo { width:64px; height:64px; border-radius:20px; background:linear-gradient(135deg,#a8544a,#c98f80); display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 14px; animation:popIcon .5s ease; position:relative; overflow:hidden; }
        .lg-logo::before { content:''; position:absolute; inset:0; background:linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.35) 45%, transparent 60%); background-size:200% 100%; animation:shimmer 3.2s ease-in-out infinite; }

        .lg-btn-primary { border:none; background:#a8544a; color:white; font-weight:800; border-radius:14px; padding:13px; font-size:14.5px; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; }
        .lg-btn-primary:disabled { background:#d8c3bd; cursor:not-allowed; }
        .lg-btn-outline { border:1.5px solid #f0ddd6; background:#fffdfc; color:#4a3634; font-weight:800; border-radius:14px; padding:13px; font-size:14.5px; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; }

        .lg-input { width:100%; border:1.5px solid #f0ddd6; border-radius:12px; padding:12px 14px; font-family:'Nunito',sans-serif; font-size:14px; color:#4a3634; outline:none; }
        .lg-input:focus { border-color:#a8544a; }
        .lg-input.codigo { text-align:center; letter-spacing:6px; font-family:'JetBrains Mono',monospace; font-size:20px; font-weight:800; text-transform:uppercase; }
        .lg-label { font-size:11.5px; font-weight:700; color:#8a6f6a; margin-bottom:5px; display:block; }

        .lg-tabs { display:flex; gap:8px; margin-bottom:16px; }
        .lg-tab { flex:1; text-align:center; padding:9px 0; border-radius:11px; font-weight:800; font-size:13px; cursor:pointer; border:1.5px solid #f0ddd6; background:#fffdfc; color:#8a6f6a; }
        .lg-tab.active { background:#a8544a; border-color:#a8544a; color:white; }

        .lg-codigo-box {
          font-family:'JetBrains Mono',monospace; font-size:30px; font-weight:800; letter-spacing:6px; color:#a8544a;
          text-align:center; background:#fbeae7; border:2px dashed #e5cdc5; border-radius:16px; padding:18px 0;
        }

        .lg-back { font-size:13px; color:#a8938e; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; }

        .lg-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; }

        .lg-error { font-size:12.5px; color:#c94a3f; background:#fbe7e5; border-radius:10px; padding:8px 12px; text-align:center; }

        .lg-check-circle { width:70px; height:70px; border-radius:50%; background:#7fb88f; display:flex; align-items:center; justify-content:center; font-size:34px; color:white; margin:0 auto 16px; animation:checkPop .4s ease; }

        .lg-jwt-box { background:#2d2422; border-radius:12px; padding:12px 14px; text-align:left; margin-top:14px; }
        .lg-jwt-box code { color:#7fb88f; font-family:'JetBrains Mono',monospace; font-size:11px; word-break:break-all; line-height:1.6; }
      `}</style>

      <div className="lg-root" style={styles.container}>
        <div className="lg-logo">💛</div>
        <div className="lg-serif" style={{ fontSize: 22, fontWeight: 600, color: "#4a3634", textAlign: "center" }}>
          Jornada do Casal
        </div>

        {tela === "inicio" && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <div style={{ fontSize: 13.5, color: "#6b5450", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              Cada casal tem um código único. Crie um novo ou entre com o código que seu par já tem.
            </div>
            <button className="lg-btn-primary" onClick={() => irPara("criar")}>🆕 Criar novo casal</button>
            <div style={{ height: 10 }} />
            <button className="lg-btn-outline" onClick={() => irPara("entrarCodigo")}>🔑 Já tenho um código</button>
          </div>
        )}

        {tela === "criar" && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <span className="lg-back" onClick={() => irPara("inicio")}>← voltar</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#4a3634", marginTop: 14, marginBottom: 10 }}>
              Esse é o código do seu casal
            </div>
            <div className="lg-codigo-box">{codigo}</div>
            <div style={{ fontSize: 11.5, color: "#a8938e", textAlign: "center", marginTop: 10 }}>
              Guarde ou compartilhe com seu par — ele vai usar esse código pra entrar
            </div>
            <div style={{ height: 18 }} />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8a6f6a", marginBottom: 10 }}>Agora crie sua conta pessoal</div>
            <label className="lg-label">Usuário</label>
            <input className="lg-input" placeholder="ex: jose" value={usuario} onChange={(e) => setUsuario(e.target.value)} style={{ marginBottom: 10 }} />
            <label className="lg-label">Senha</label>
            <input className="lg-input" type="password" placeholder="mín. 4 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={autenticar} disabled={carregando}>
              {carregando ? (<><span className="lg-spinner" />Criando...</>) : "Criar conta e entrar"}
            </button>
          </div>
        )}

        {tela === "entrarCodigo" && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <span className="lg-back" onClick={() => irPara("inicio")}>← voltar</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#4a3634", marginTop: 14, marginBottom: 12 }}>
              Digite o código do casal
            </div>
            <input
              className="lg-input codigo"
              maxLength={6}
              placeholder="XXXXXX"
              value={codigoDigitado}
              onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
            />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={confirmarCodigo}>Continuar</button>
          </div>
        )}

        {tela === "auth" && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20 }}>
            <span className="lg-back" onClick={() => irPara("entrarCodigo")}>← voltar</span>
            <div style={{ fontSize: 12, color: "#a8938e", marginTop: 14, marginBottom: 4 }}>Casal</div>
            <div className="lg-mono" style={{ fontSize: 16, fontWeight: 800, color: "#a8544a", marginBottom: 16, letterSpacing: 2 }}>
              {codigoDigitado || codigo}
            </div>

            <div className="lg-tabs">
              <div className={`lg-tab ${modoAuth === "login" ? "active" : ""}`} onClick={() => setModoAuth("login")}>Entrar</div>
              <div className={`lg-tab ${modoAuth === "registrar" ? "active" : ""}`} onClick={() => setModoAuth("registrar")}>Registrar</div>
            </div>

            <label className="lg-label">Usuário</label>
            <input className="lg-input" placeholder="ex: maria" value={usuario} onChange={(e) => setUsuario(e.target.value)} style={{ marginBottom: 10 }} />
            <label className="lg-label">Senha</label>
            <input className="lg-input" type="password" placeholder="sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
            {erro && <div className="lg-error" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="lg-btn-primary" style={{ marginTop: 16 }} onClick={autenticar} disabled={carregando}>
              {carregando ? (<><span className="lg-spinner" />Entrando...</>) : modoAuth === "login" ? "Entrar" : "Criar conta neste casal"}
            </button>
          </div>
        )}

        {tela === "sucesso" && tokenDemo && (
          <div className="lg-card" style={{ padding: 24, marginTop: 20, textAlign: "center" }}>
            <div className="lg-check-circle">✓</div>
            <div className="lg-serif" style={{ fontSize: 18, fontWeight: 600, color: "#4a3634" }}>Conectado!</div>
            <div style={{ fontSize: 13, color: "#6b5450", marginTop: 6 }}>
              Bem-vindo(a) de volta, {usuario || "parceiro(a)"}.
            </div>
            <div className="lg-jwt-box">
              <div style={{ fontSize: 10.5, color: "#a8938e", marginBottom: 6, fontWeight: 700 }}>TOKEN JWT RECEBIDO · válido por {tokenDemo.exp}</div>
              <code>{tokenDemo.payload}</code>
            </div>
            <button className="lg-btn-primary" style={{ marginTop: 18 }}>Entrar no app</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#faf1ee", padding: "40px 14px 40px", display: "flex", justifyContent: "center" },
  container: { width: "100%", maxWidth: 380 },
};
