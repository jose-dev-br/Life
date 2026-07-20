import React, { useState, useEffect } from "react";

const QUIZ_HOJE = {
  pergunta: "Se surgisse um fim de semana livre do nada, o que vocês fariam?",
  opcoes: [
    { id: "a", emoji: "🏖️", texto: "Viagem surpresa pra algum lugar perto" },
    { id: "b", emoji: "🛋️", texto: "Maratonar série o dia inteiro, sem sair de casa" },
    { id: "c", emoji: "🍳", texto: "Cozinhar uma receita nova e complicada juntos" },
    { id: "d", emoji: "🎮", texto: "Jogar algo juntos a tarde toda" },
  ],
};

// Resposta "real" da Maria, guardada só pro mock simular o reveal.
const RESPOSTA_REAL_PARCEIRO = "a";

const HISTORICO_MOCK = [
  { id: "h1", pergunta: "Praia ou montanha pra próxima viagem?", minha: "Praia", parceiro: "Praia", bateu: true, previu: true },
  { id: "h2", pergunta: "Pizza ou hambúrguer no sábado?", minha: "Pizza", parceiro: "Hambúrguer", bateu: false, previu: false },
  { id: "h3", pergunta: "Acordar cedo ou dormir até tarde no domingo?", minha: "Dormir até tarde", parceiro: "Dormir até tarde", bateu: true, previu: true },
  { id: "h4", pergunta: "Assistir terror ou comédia hoje?", minha: "Comédia", parceiro: "Terror", bateu: false, previu: true },
  { id: "h5", pergunta: "Economizar ou se dar um mimo esse mês?", minha: "Se dar um mimo", parceiro: "Se dar um mimo", bateu: true, previu: false },
];

export default function QuizCasalMock() {
  const [entrou, setEntrou] = useState(false);
  const [etapa, setEtapa] = useState("responder"); // responder -> prever -> aguardando -> revelado
  const [minhaResposta, setMinhaResposta] = useState(null);
  const [minhaPrevisao, setMinhaPrevisao] = useState(null);
  const [historicoExpandido, setHistoricoExpandido] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntrou(true), 60);
    return () => clearTimeout(t);
  }, []);

  const sintoniaGeral = Math.round((HISTORICO_MOCK.filter((h) => h.bateu).length / HISTORICO_MOCK.length) * 100);
  const acertosPrevisao = HISTORICO_MOCK.filter((h) => h.previu).length;

  function escolherResposta(id) {
    setMinhaResposta(id);
    setEtapa("prever");
  }

  function escolherPrevisao(id) {
    setMinhaPrevisao(id);
    setEtapa("aguardando");
    // simula esperar a Maria responder — no app real isso vem via sync,
    // aqui só demonstra a transição de estado
    setTimeout(() => setEtapa("revelado"), 1200);
  }

  const bateu = minhaResposta === RESPOSTA_REAL_PARCEIRO;
  const acertouPrevisao = minhaPrevisao === RESPOSTA_REAL_PARCEIRO;
  const opcaoPorId = (id) => QUIZ_HOJE.opcoes.find((o) => o.id === id);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        .qz-root { font-family: 'Nunito', sans-serif; }
        .qz-serif { font-family: 'Fraunces', serif; }
        .qz-mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
        @keyframes popIcon { 0%{transform:scale(.6) rotate(-8deg);opacity:0;} 60%{transform:scale(1.12) rotate(3deg);opacity:1;} 100%{transform:scale(1) rotate(0);opacity:1;} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes pulseDots { 0%,100%{opacity:0.3;} 50%{opacity:1;} }
        @keyframes matchPop { 0%{transform:scale(0);} 60%{transform:scale(1.2);} 100%{transform:scale(1);} }
        @keyframes fillBar { from{width:0%;} }
        @media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms !important; } }

        .qz-card { background:#fffdfc; border-radius:20px; border:1.5px solid #f0ddd6; box-shadow:0 2px 12px rgba(180,120,110,0.07); }

        .qz-spotlight { position:relative; overflow:hidden; padding:22px; border-radius:24px; }
        .qz-spotlight::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.35) 45%, transparent 60%);
          background-size:200% 100%; animation:shimmer 3.2s ease-in-out infinite;
        }

        .qz-opcao {
          display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:16px; margin-top:10px;
          background:rgba(255,255,255,0.16); border:1.5px solid rgba(255,255,255,0.3); cursor:pointer; color:white;
          transition:background .15s ease;
        }
        .qz-opcao:active { background:rgba(255,255,255,0.3); }
        .qz-opcao:first-child { margin-top:16px; }

        .qz-opcao-clara {
          display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:16px; margin-top:10px;
          background:#fffdfc; border:1.5px solid #f0ddd6; cursor:pointer; color:#4a3634;
        }
        .qz-opcao-clara:first-child { margin-top:16px; }
        .qz-opcao-clara:active { background:#faf1ee; }

        .qz-dots span { animation:pulseDots 1.2s ease-in-out infinite; display:inline-block; }
        .qz-dots span:nth-child(2) { animation-delay:.2s; }
        .qz-dots span:nth-child(3) { animation-delay:.4s; }

        .qz-reveal-row { display:flex; gap:10px; margin-top: 14px; }
        .qz-reveal-card { flex:1; border-radius:16px; padding:14px; text-align:center; }
        .qz-match-badge {
          display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:999px; font-weight:800; font-size:13px;
          animation:matchPop .4s ease;
        }

        .qz-bar-track { background:#f5e6e1; border-radius:999px; overflow:hidden; }
        .qz-bar-fill { height:100%; border-radius:999px; animation:fillBar .9s cubic-bezier(.2,.8,.2,1); }

        .qz-row { display:flex; align-items:center; gap:10px; padding:10px 4px; border-bottom:1px solid #f5e6e1; cursor:pointer; }
        .qz-row:last-child { border-bottom:none; }
      `}</style>

      <div className="qz-root" style={styles.container}>
        <div className="qz-serif" style={{ fontSize: 22, fontWeight: 600, color: "#4a3634" }}>Quiz do dia</div>

        {/* Sintonia geral — dá contexto antes do quiz de hoje */}
        <div
          className="qz-card"
          style={{
            padding: 16,
            opacity: entrou ? 1 : 0,
            transform: entrou ? "translateY(0)" : "translateY(10px)",
            transition: "opacity .5s ease, transform .5s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "#4a3634" }}>💞 Sintonia do casal</span>
            <span className="qz-mono" style={{ color: "#a87fd9", fontWeight: 800 }}>{sintoniaGeral}%</span>
          </div>
          <div className="qz-bar-track" style={{ height: 8 }}>
            <div className="qz-bar-fill" style={{ width: `${sintoniaGeral}%`, background: "#a87fd9" }} />
          </div>
          <div style={{ fontSize: 11, color: "#a8938e", marginTop: 6 }}>
            respostas iguais em {HISTORICO_MOCK.filter((h) => h.bateu).length} dos últimos {HISTORICO_MOCK.length} quizzes · você adivinhou o que ela escolheria {acertosPrevisao}x
          </div>
        </div>

        {/* Quiz de hoje */}
        <div
          className="qz-spotlight"
          style={{
            background: "linear-gradient(135deg, #a87fd9, #a87fd9cc)",
            opacity: entrou ? 1 : 0,
            transform: entrou ? "translateY(0)" : "translateY(10px)",
            transition: "opacity .5s ease .1s, transform .5s ease .1s",
          }}
        >
          {etapa === "responder" && (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
                Sua resposta é privada até os dois responderem
              </div>
              <div className="qz-serif" style={{ color: "white", fontSize: 17, fontWeight: 600, marginTop: 8 }}>
                {QUIZ_HOJE.pergunta}
              </div>
              {QUIZ_HOJE.opcoes.map((o) => (
                <div key={o.id} className="qz-opcao" onClick={() => escolherResposta(o.id)}>
                  <span style={{ fontSize: 20 }}>{o.emoji}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{o.texto}</span>
                </div>
              ))}
            </>
          )}

          {etapa === "prever" && (
            <div style={{ animation: "fadeSlideIn .3s ease" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
                Agora tente adivinhar
              </div>
              <div className="qz-serif" style={{ color: "white", fontSize: 17, fontWeight: 600, marginTop: 8 }}>
                O que você acha que a Maria vai escolher?
              </div>
              {QUIZ_HOJE.opcoes.map((o) => (
                <div key={o.id} className="qz-opcao" onClick={() => escolherPrevisao(o.id)}>
                  <span style={{ fontSize: 20 }}>{o.emoji}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{o.texto}</span>
                </div>
              ))}
            </div>
          )}

          {etapa === "aguardando" && (
            <div style={{ textAlign: "center", padding: "30px 0", animation: "fadeSlideIn .3s ease" }}>
              <div style={{ fontSize: 30 }}>⏳</div>
              <div className="qz-serif" style={{ color: "white", fontSize: 15, fontWeight: 600, marginTop: 10 }}>
                Esperando a Maria responder
                <span className="qz-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11.5, marginTop: 6 }}>
                Sua resposta já foi registrada
              </div>
            </div>
          )}

          {etapa === "revelado" && (
            <div style={{ animation: "fadeSlideIn .35s ease" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
                Revelado!
              </div>
              <div className="qz-serif" style={{ color: "white", fontSize: 16, fontWeight: 600, marginTop: 8 }}>
                {QUIZ_HOJE.pergunta}
              </div>

              <div className="qz-reveal-row">
                <div className="qz-reveal-card" style={{ background: "rgba(255,255,255,0.16)" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>VOCÊ</div>
                  <div style={{ fontSize: 26, marginTop: 4 }}>{opcaoPorId(minhaResposta)?.emoji}</div>
                  <div style={{ fontSize: 11, color: "white", marginTop: 4 }}>{opcaoPorId(minhaResposta)?.texto}</div>
                </div>
                <div className="qz-reveal-card" style={{ background: "rgba(255,255,255,0.16)" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>MARIA</div>
                  <div style={{ fontSize: 26, marginTop: 4 }}>{opcaoPorId(RESPOSTA_REAL_PARCEIRO)?.emoji}</div>
                  <div style={{ fontSize: 11, color: "white", marginTop: 4 }}>{opcaoPorId(RESPOSTA_REAL_PARCEIRO)?.texto}</div>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <span
                  className="qz-match-badge"
                  style={{
                    background: bateu ? "rgba(127,184,143,0.9)" : "rgba(255,255,255,0.9)",
                    color: bateu ? "white" : "#a87fd9",
                  }}
                >
                  {bateu ? "💚 Vocês pensam igual!" : "🤔 Pontos de vista diferentes"}
                </span>
              </div>

              <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {acertouPrevisao ? "✨ E você acertou a previsão!" : "Você não previu essa — próxima vez tenta de novo"}
              </div>
            </div>
          )}
        </div>

        {/* Histórico de quizzes anteriores */}
        <div className="qz-card" style={{ padding: 16 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setHistoricoExpandido((v) => !v)}
          >
            <span style={{ fontSize: 13.5, fontWeight: 800, color: "#4a3634" }}>📋 Quizzes anteriores</span>
            <span style={{ fontSize: 12.5, color: "#a8544a", fontWeight: 700 }}>{historicoExpandido ? "recolher ▲" : "ver tudo ▼"}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            {(historicoExpandido ? HISTORICO_MOCK : HISTORICO_MOCK.slice(0, 3)).map((h) => (
              <div key={h.id} className="qz-row">
                <span style={{ fontSize: 15 }}>{h.bateu ? "💚" : "🤔"}</span>
                <span style={{ flex: 1, fontSize: 13, color: "#4a3634", fontWeight: 600 }}>{h.pergunta}</span>
                {h.previu && <span style={{ fontSize: 10, color: "#a87fd9", fontWeight: 800 }}>previu ✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#faf1ee", padding: "24px 14px 60px", display: "flex", justifyContent: "center" },
  container: { width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 },
};
