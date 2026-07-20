import React, { useState, useEffect } from "react";

const APPS = [
  {
    id: "diario",
    nome: "Diário",
    icone: "📝",
    cor: "#a8544a",
    desc: "Cartas, quiz do dia, humor",
    conquistas: { atual: 8, total: 20 },
    streak: 7,
    ultimaAtividade: "Quiz respondido há 2h",
  },
  {
    id: "jogos",
    nome: "Jogos",
    icone: "🎮",
    cor: "#a87fd9",
    desc: "Snake, Ludo, Bubble, Pokédex",
    conquistas: { atual: 5, total: 15 },
    streak: 3,
    ultimaAtividade: "Novo Pokémon capturado ontem",
  },
  {
    id: "saude",
    nome: "Saúde",
    icone: "🏋️",
    cor: "#7fb88f",
    desc: "Peso, ciclo, academia",
    conquistas: { atual: 12, total: 25 },
    streak: 12,
    ultimaAtividade: "Pesagem registrada hoje",
  },
];

export default function HubMock() {
  const [entrou, setEntrou] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntrou(true), 60);
    return () => clearTimeout(t);
  }, []);

  const totalConquistas = APPS.reduce((s, a) => s + a.conquistas.atual, 0);
  const totalPossivel = APPS.reduce((s, a) => s + a.conquistas.total, 0);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        .hb-root { font-family: 'Nunito', sans-serif; }
        .hb-serif { font-family: 'Fraunces', serif; }
        .hb-mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
        @keyframes popIcon { 0%{transform:scale(.6) rotate(-8deg);opacity:0;} 60%{transform:scale(1.12) rotate(3deg);opacity:1;} 100%{transform:scale(1) rotate(0);opacity:1;} }
        @keyframes fillBar { from{width:0%;} }
        @media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms !important; } }

        .hb-card { background:#fffdfc; border-radius:20px; border:1.5px solid #f0ddd6; box-shadow:0 2px 12px rgba(180,120,110,0.07); }

        .hb-app-card {
          padding:18px; border-radius:22px; cursor:pointer; display:flex; align-items:center; gap:14px;
          animation:fadeSlideIn .4s ease both; transition:transform .15s ease;
        }
        .hb-app-card:active { transform:scale(0.98); }
        .hb-app-icon { width:52px; height:52px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; animation:popIcon .5s ease; }
        .hb-bar-track { background:#f5e6e1; border-radius:999px; overflow:hidden; }
        .hb-bar-fill { height:100%; border-radius:999px; animation:fillBar .9s cubic-bezier(.2,.8,.2,1); }
        .hb-arrow { font-size:18px; color:#c2aca4; }

        .hb-footer { text-align:center; padding:14px; }
      `}</style>

      <div className="hb-root" style={styles.container}>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div className="hb-serif" style={{ fontSize: 24, fontWeight: 600, color: "#4a3634" }}>Jornada do Casal</div>
          <div style={{ fontSize: 12.5, color: "#a8938e", marginTop: 4 }}>José & Maria</div>
        </div>

        <div
          className="hb-card"
          style={{
            padding: 16,
            textAlign: "center",
            opacity: entrou ? 1 : 0,
            transition: "opacity .4s ease",
          }}
        >
          <div className="hb-mono" style={{ fontSize: 20, fontWeight: 800, color: "#4a3634" }}>
            {totalConquistas}/{totalPossivel}
          </div>
          <div style={{ fontSize: 10.5, color: "#a8938e", fontWeight: 700, textTransform: "uppercase" }}>
            conquistas no ecossistema todo
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {APPS.map((app, idx) => {
            const pct = Math.round((app.conquistas.atual / app.conquistas.total) * 100);
            return (
              <div
                key={app.id}
                className="hb-card hb-app-card"
                style={{ animationDelay: entrou ? `${idx * 0.08}s` : "0s", opacity: entrou ? undefined : 0 }}
              >
                <div className="hb-app-icon" style={{ background: app.cor + "22" }}>{app.icone}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div className="hb-serif" style={{ fontSize: 17, fontWeight: 600, color: "#4a3634" }}>{app.nome}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: app.cor }}>🔥 {app.streak}d</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#a8938e", marginTop: 1 }}>{app.desc}</div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#8a6f6a", marginBottom: 3 }}>
                      <span>🎖️ conquistas próprias</span>
                      <span className="hb-mono">{app.conquistas.atual}/{app.conquistas.total}</span>
                    </div>
                    <div className="hb-bar-track" style={{ height: 6 }}>
                      <div className="hb-bar-fill" style={{ width: `${pct}%`, background: app.cor }} />
                    </div>
                  </div>

                  <div style={{ fontSize: 10.5, color: "#c2aca4", marginTop: 6, fontStyle: "italic" }}>{app.ultimaAtividade}</div>
                </div>
                <span className="hb-arrow">›</span>
              </div>
            );
          })}
        </div>

        <div className="hb-footer">
          <div style={{ fontSize: 10.5, color: "#c2aca4" }}>
            cada app guarda sua própria linha de conquistas — o total acima é só informativo
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#faf1ee", padding: "24px 14px 40px", display: "flex", justifyContent: "center" },
  container: { width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 },
};
