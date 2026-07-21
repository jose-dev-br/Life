const { useState, useEffect, useCallback, useRef } = React;

const UBER_DAY_MS = 86400000;

const DEFAULT_SETTINGS = {
  weeklyNetGoal: 800,
  weeklyRent: 590,
  fuelPricePerLiter: 4.99,
  consumptionKmPerLiter: 12,
  averageGrossPerHour: 40,
  averageGrossPerPaidKm: 1.10,
  restRules: { minimumSleepHours: 7, postCltBufferHours: 2, maximumUberHoursPerDay: 6 },
  cltSchedule: { anchorDate: '', shiftStart: '18:00', shiftEnd: '05:00', patternType: '2x2_3x3' }
};

const OPPORTUNITY_EVENTS = [
  { id: 'arena-brb', name: 'Arena BRB - Grandes eventos', area: 'Brasília - DF', demand: 'high', surge: '2.0x - 3.0x', bestTimes: ['18:00','19:00','20:00','22:30','23:00'], goodTimes: ['17:00','21:00','23:30'] },
  { id: 'aeroporto-jk', name: 'Aeroporto JK - Chegadas', area: 'Brasília - DF', demand: 'high', surge: '2.0x - 3.0x', bestTimes: ['10:30','11:30','16:30','17:30','20:30'], goodTimes: ['10:00','11:00','16:00','17:00','20:00'] },
  { id: 'asa-norte', name: 'Asa Norte - bares noturnos', area: 'Asa Norte - DF', demand: 'high', surge: '1.8x - 2.5x', bestTimes: ['21:00','22:00','23:00','00:00'], goodTimes: ['20:00','01:00'] },
  { id: 'rodoviaria', name: 'Rodoviária do Plano Piloto', area: 'Brasília - DF', demand: 'high', surge: '2.0x - 3.0x', bestTimes: ['06:00','07:00','08:00','17:00','18:00','19:00'], goodTimes: ['05:00','09:00','16:00','20:00'] },
  { id: 'brasilia-shopping', name: 'Brasília Shopping', area: 'Brasília - DF', demand: 'medium', surge: '1.5x - 2.0x', bestTimes: ['10:00','11:00','14:00','15:00'], goodTimes: ['09:00','12:00','16:00'] },
  { id: 'feira-ceilandia', name: 'Feira da Ceilândia', area: 'Ceilândia - DF', demand: 'medium', surge: '1.8x - 2.2x', bestTimes: ['08:00','09:00','10:00'], goodTimes: ['07:00','11:00'] },
  { id: 'taguatinga', name: 'Taguatinga Shopping - Cinema', area: 'Taguatinga - DF', demand: 'medium', surge: '1.3x - 1.8x', bestTimes: ['19:00','20:00','21:00'], goodTimes: ['18:00','22:00'] },
  { id: 'parque-cidade', name: 'Parque da Cidade - Domingo', area: 'Brasília - DF', demand: 'normal', surge: '1.0x - 1.2x', bestTimes: ['08:00','09:00','16:00'], goodTimes: ['07:00','10:00','17:00'] },
];

const DEMAND_META = { high: { label: 'Alta', icon: '🔥', color: '#e0716a' }, medium: { label: 'Média', icon: '📈', color: '#e0a24a' }, normal: { label: 'Normal', icon: '📊', color: '#7f9fc9' } };

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function normalizeDate(v) { const d = v instanceof Date ? v : new Date((v || getTodayStr()) + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
function fmtDate(d) { return normalizeDate(d).toISOString().split('T')[0]; }
function dateOffset(ds, days) { const d = normalizeDate(ds); d.setDate(d.getDate() + days); return fmtDate(d); }
function timeToMin(t) { const [h,m] = String(t||'00:00').split(':').map(Number); return (h||0)*60+(m||0); }
function minToTime(m) { const n = ((Math.round(m)%1440)+1440)%1440; return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
function fmtCurrency(v) { return 'R$ ' + Number(v||0).toFixed(2).replace('.',','); }
function parseNum(v) { if(typeof v==='number')return v; const n=parseFloat(String(v||'').replace(',','.').trim()); return Number.isFinite(n)?n:0; }

function schedulePattern(s) {
  if ((s.patternType||'2x2_3x3')==='2x2_3x3') return ['work','work','off','off','work','work','work','off','off','off'];
  if (s.patternType==='3x2') return ['work','work','work','off','off'];
  return ['work','work','off','off','work','work','work','off','off','off'];
}

function getScheduleDay(targetDate, settings, overrides) {
  const ds = fmtDate(targetDate);
  const ov = (overrides||[]).find(o => o.date === ds);
  if (ov) return { type: ov.overrideType, isWorkDay: ov.overrideType==='work', isOffDay: ov.overrideType==='off' };
  if (!settings.cltSchedule.anchorDate) return { type: 'unknown', isWorkDay: false, isOffDay: false };
  const diff = Math.round((normalizeDate(targetDate).getTime() - normalizeDate(settings.cltSchedule.anchorDate).getTime()) / UBER_DAY_MS);
  const pat = schedulePattern(settings.cltSchedule);
  const idx = ((diff % pat.length) + pat.length) % pat.length;
  const type = pat[idx];
  return { type, isWorkDay: type==='work', isOffDay: type==='off' };
}

function weekStart(ds) { const d=normalizeDate(ds); const day=d.getDay(); const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return d; }
function weekId(ds) { const s=weekStart(ds); const ys=new Date(s.getFullYear(),0,1,12); const w=Math.ceil((((s-ys)/UBER_DAY_MS)+ys.getDay()+1)/7); return s.getFullYear()+'-W'+String(w).padStart(2,'0'); }

function weekSummary(dateStr, sessions, settings) {
  const start = weekStart(dateStr);
  const end = new Date(start.getTime() + 6 * UBER_DAY_MS);
  const filtered = sessions.filter(s => { const d = normalizeDate(s.date); return d >= start && d <= end; });
  const grossRevenue = filtered.reduce((s,x) => s + parseNum(x.grossRevenue), 0);
  const totalKm = filtered.reduce((s,x) => s + parseNum(x.distanceKm||0), 0);
  const totalHours = filtered.reduce((s,x) => {
    const [sh,sm]=String(x.startedAt||'00:00').split(':').map(Number);
    const [eh,em]=String(x.endedAt||'00:00').split(':').map(Number);
    let min=(eh*60+em)-(sh*60+sm); if(min<0)min+=1440;
    return s + min/60;
  }, 0);
  const consumption = settings.consumptionKmPerLiter || 12;
  const fuelCost = (totalKm / consumption) * (settings.fuelPricePerLiter || 4.99);
  const contribution = grossRevenue - fuelCost;
  const netProfit = contribution - (settings.weeklyRent || 0);
  const remaining = Math.max(0, (settings.weeklyNetGoal || 800) - netProfit);
  const progress = Math.min(100, Math.max(0, (netProfit / (settings.weeklyNetGoal||800)) * 100));
  return { id: weekId(dateStr), sessions: filtered, grossRevenue, fuelCost, totalKm, totalHours, contribution, netProfit, remaining, progress };
}

function uberRecommendation(dateStr, sessions, settings, overrides) {
  const week = weekSummary(dateStr, sessions, settings);
  const scheduleDay = getScheduleDay(dateStr, settings, overrides);
  if (!settings.cltSchedule.anchorDate) return { state: 'insufficient_data', shouldDrive: false, title: 'Configure a escala', message: 'Informe uma data conhecida do ciclo CLT.' };
  if (week.remaining <= 0) return { state: 'goal_reached', shouldDrive: false, title: 'Meta atingida', message: 'A meta semanal já foi concluída.' };
  if (scheduleDay.isWorkDay) return { state: 'clt_day', shouldDrive: false, title: 'Dia de CLT', message: 'Evite sessão longa antes do turno.' };

  const costPerKm = (settings.fuelPricePerLiter||4.99) / (settings.consumptionKmPerLiter||12);
  const paidKmPerHour = (settings.averageGrossPerHour||40) / (settings.averageGrossPerPaidKm||1.10);
  const perHour = (settings.averageGrossPerHour||40) - (paidKmPerHour * costPerKm);
  const rawHours = week.remaining / Math.max(1, perHour);
  const recommendedHours = Math.min(settings.restRules.maximumUberHoursPerDay || 6, Math.ceil(rawHours * 2) / 2);
  const startAt = '09:30';
  const totalMin = timeToMin(startAt) + recommendedHours * 60;
  const endAt = minToTime(totalMin);

  return { state: 'opportunity', shouldDrive: true, title: 'Boa oportunidade', message: `Folga com meta em aberto. Rode ${recommendedHours}h.`, recommendedHours, startAt, endAt, expectedContribution: recommendedHours * perHour };
}

function calcSession(s) {
  const km = parseNum(s.distanceKm);
  const [sh,sm]=String(s.startedAt||'00:00').split(':').map(Number);
  const [eh,em]=String(s.endedAt||'00:00').split(':').map(Number);
  let min=(eh*60+em)-(sh*60+sm); if(min<0)min+=1440;
  const hours = min/60;
  const consumption = parseNum(s.consumptionKmPerLiter) || 12;
  const fuelPrice = parseNum(s.fuelPricePerLiter) || 4.99;
  const gross = parseNum(s.grossRevenue);
  const fuelCost = (km/consumption)*fuelPrice;
  const contribution = gross - fuelCost;
  return { ...s, totalKm: km, durationHours: hours, fuelCost, contribution, contributionPerHour: hours>0?contribution/hours:0 };
}

const REC_STATES = {
  opportunity: { cor: '#7fb88f', icone: '🚗' },
  clt_day: { cor: '#e0a24a', icone: '🏭' },
  goal_reached: { cor: '#a87fd9', icone: '🎉' },
  insufficient_data: { cor: '#a8938e', icone: '⚙️' },
};

function UberRoutine() {
  const [entrou, setEntrou] = useState(false);
  const [tab, setTab] = useState('today');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [erro, setErro] = useState(null);
  const auth = LifeStore.getAuth();
  const user = auth.user || '';
  const carregandoRef = useRef(false);

  const carregar = useCallback(async () => {
    if (carregandoRef.current) return;
    carregandoRef.current = true;
    setErro(null);
    try {
      const [s, sess, ov] = await Promise.all([LifeAPI.uber.getSettings(), LifeAPI.uber.getSessions(), LifeAPI.uber.getOverrides()]);
      if (s.ok && s.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings, restRules: { ...DEFAULT_SETTINGS.restRules, ...(s.settings.restRules||{}) }, cltSchedule: { ...DEFAULT_SETTINGS.cltSchedule, ...(s.settings.cltSchedule||{}) } });
      if (sess.ok) setSessions(sess.sessions || []);
      if (ov.ok) setOverrides(ov.overrides || []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar');
    } finally {
      carregandoRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!LifeStore.getAuth().token) { window.location.href = '/'; return; }
    const t = setTimeout(() => setEntrou(true), 60);
    carregar();
    return () => clearTimeout(t);
  }, [carregar]);

  async function saveSettings(newSettings) {
    setSettings(newSettings);
    try { await LifeAPI.uber.saveSettings({ settings: newSettings }); } catch (e) { setErro('Erro ao salvar'); }
  }

  async function saveSession(session) {
    const id = session.id || (session.date + '_' + Date.now());
    const toSave = { ...session, id };
    setSessions(prev => { const idx = prev.findIndex(s => s.id === id); return idx >= 0 ? prev.map((s,i) => i===idx ? toSave : s) : [toSave, ...prev]; });
    try { await LifeAPI.uber.saveSession({ id, session: toSave }); } catch (e) { setErro('Erro ao salvar'); }
  }

  async function deleteSession(id) {
    setSessions(prev => prev.filter(s => s.id !== id));
    try { await LifeAPI.uber.saveSession({ id, session: { _deleted: true } }); } catch (e) { setErro('Erro ao excluir'); }
  }

  const today = getTodayStr();
  const week = weekSummary(today, sessions, settings);
  const rec = uberRecommendation(today, sessions, settings, overrides);
  const recState = REC_STATES[rec.state] || REC_STATES.insufficient_data;
  const pct = Math.max(0, Math.min(100, week.progress));

  return (
    <div style={{ minHeight: '100vh', background: '#faf1ee', padding: '24px 14px 60px', display: 'flex', justifyContent: 'center' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}body{margin:0;background:#faf1ee;}
        .ub-root{font-family:'Nunito',sans-serif;width:100%;max-width:420px;display:flex;flex-direction:column;gap:16px;}
        .ub-serif{font-family:'Fraunces',serif;}
        .ub-mono{font-family:'JetBrains Mono',monospace;}
        @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
        @keyframes fillBar{from{width:0%;}}
        .ub-card{background:#fffdfc;border-radius:20px;border:1.5px solid #f0ddd6;box-shadow:0 2px 12px rgba(180,120,110,.07);padding:16px;}
        .ub-spotlight{position:relative;overflow:hidden;padding:20px;border-radius:24px;}
        .ub-spotlight::before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.18) 45%,transparent 60%);background-size:200% 100%;animation:shimmer 3.2s ease-in-out infinite;pointer-events:none;}
        .ub-bar-track{background:rgba(255,255,255,.35);border-radius:999px;overflow:hidden;height:7px;}
        .ub-bar-fill{height:100%;border-radius:999px;background:white;animation:fillBar .9s cubic-bezier(.2,.8,.2,1);}
        .ub-stat{flex:1;text-align:center;padding:10px 4px;}
        .ub-stat .val{font-size:17px;font-weight:800;color:white;font-family:'JetBrains Mono',monospace;}
        .ub-stat .lbl{font-size:10px;color:rgba(255,255,255,.8);font-weight:700;margin-top:2px;text-transform:uppercase;}
        .ub-chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:700;border:1.5px solid #f0ddd6;background:#fffdfc;color:#8a6f6a;cursor:pointer;white-space:nowrap;font-family:'Nunito',sans-serif;}
        .ub-chip.active{background:#a8544a;border-color:#a8544a;color:white;}
        .ub-tablist{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;}
        .ub-tablist::-webkit-scrollbar{display:none;}
        .ub-btn{border:none;background:#a8544a;color:white;font-weight:800;border-radius:14px;padding:12px;font-size:14px;cursor:pointer;width:100%;font-family:'Nunito',sans-serif;}
        .ub-btn:active{transform:scale(0.97);}
        .ub-btn-outline{border:1.5px solid #f0ddd6;background:#fffdfc;color:#8a6f6a;font-weight:800;border-radius:14px;padding:12px;font-size:14px;cursor:pointer;width:100%;font-family:'Nunito',sans-serif;}
        .ub-input{width:100%;border:1.5px solid #f0ddd6;border-radius:12px;padding:10px 13px;font-family:'Nunito',sans-serif;font-size:13.5px;color:#4a3634;outline:none;background:#fffdfc;}
        .ub-input:focus{border-color:#a8544a;}
        .ub-label{font-size:11px;font-weight:700;color:#8a6f6a;margin-bottom:4px;display:block;}
        .ub-row{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #f5e6e1;}
        .ub-row:last-child{border-bottom:none;}
        .ub-event{padding:14px;border-left:4px solid var(--ec);display:flex;flex-direction:column;gap:8px;}
        .ub-time-slot{font-size:11.5px;font-weight:800;border-radius:999px;padding:5px 9px;background:#f8ebe7;color:#8a6f6a;}
        .ub-time-slot.best{background:#e8f3ec;color:#4b9564;}
        .ub-demand{border-radius:999px;padding:4px 9px;font-size:10.5px;font-weight:900;color:var(--dc);background:#fff4ef;white-space:nowrap;}
      `}</style>

      <div className="ub-root">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/hub.html" style={{ fontSize: 13, color: '#a8938e', fontWeight: 700, textDecoration: 'none' }}>← voltar ao hub</a>
          <div className="ub-serif" style={{ fontSize: 20, fontWeight: 600, color: '#4a3634' }}>Rotina Uber</div>
        </div>

        {erro && <div style={{ background: '#fde8e8', color: '#c0392b', padding: '10px 14px', borderRadius: 12, fontSize: 13, border: '1px solid #f5c6c6' }}>⚠️ {erro}</div>}

        <div className="ub-tablist">
          {[['today','Hoje'],['opportunities','Oportunidades'],['week','Semana'],['sessions','Sessões'],['settings','Ajustes']].map(([id,label]) => (
            <button key={id} className={`ub-chip ${tab===id?'active':''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'today' && (
          <>
            <div className="ub-spotlight" style={{ background: `linear-gradient(135deg, ${recState.cor}, ${recState.cor}cc)` }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: 800, textTransform: 'uppercase' }}>{week.id}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 30 }}>{recState.icone}</span>
                <span className="ub-serif" style={{ color: 'white', fontSize: 19, fontWeight: 600 }}>{rec.title}</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,.92)', fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>{rec.message}</div>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.9)', marginBottom: 4 }}>
                  <span>Meta líquida semanal</span>
                  <span className="ub-mono" style={{ fontWeight: 700 }}>{fmtCurrency(week.netProfit)} / {fmtCurrency(settings.weeklyNetGoal)}</span>
                </div>
                <div className="ub-bar-track"><div className="ub-bar-fill" style={{ width: `${pct}%` }} /></div>
              </div>
              <div style={{ display: 'flex', marginTop: 16, background: 'rgba(255,255,255,.18)', borderRadius: 14, padding: 4 }}>
                <div className="ub-stat"><div className="val">{fmtCurrency(week.remaining)}</div><div className="lbl">Faltam</div></div>
                <div className="ub-stat"><div className="val">{rec.recommendedHours ? Number(rec.recommendedHours).toFixed(1).replace('.0','') : '0'}h</div><div className="lbl">Estimado</div></div>
                <div className="ub-stat"><div className="val">{rec.startAt || '—'}</div><div className="lbl">Começar</div></div>
              </div>
            </div>
            {rec.shouldDrive && <button className="ub-btn" onClick={() => setTab('sessions')}>Iniciar sessão ({rec.startAt} – {rec.endAt})</button>}
          </>
        )}

        {tab === 'opportunities' && (
          <>
            <div className="ub-card">
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a6f6a', textTransform: 'uppercase', marginBottom: 6 }}>📍 Oportunidades DF</div>
              <div style={{ fontSize: 12, color: '#6b5450' }}>Pontos de demanda estimados. Conferir agenda oficial.</div>
            </div>
            {OPPORTUNITY_EVENTS.map(ev => {
              const meta = DEMAND_META[ev.demand];
              return (
                <div key={ev.id} className="ub-card ub-event" style={{ '--ec': meta.color }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: '#4a3634' }}>{ev.name}</div>
                    <span className="ub-demand" style={{ '--dc': meta.color }}>{meta.icon} {meta.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#a8938e' }}>{ev.area}</div>
                  <div style={{ fontSize: 13, color: '#4a3634' }}><b>Surge:</b> {ev.surge}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {ev.bestTimes.map(t => <span key={t} className="ub-time-slot best">⭐ {t}</span>)}
                    {ev.goodTimes.map(t => <span key={t} className="ub-time-slot">{t}</span>)}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'week' && (
          <div className="ub-card">
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a6f6a', textTransform: 'uppercase', marginBottom: 12 }}>🎯 Semana {week.id}</div>
            <div style={{ display: 'flex' }}>
              <div className="ub-stat"><div className="val" style={{ color: '#4a3634' }}>{fmtCurrency(week.grossRevenue)}</div><div className="lbl" style={{ color: '#a8938e' }}>Bruto</div></div>
              <div className="ub-stat"><div className="val" style={{ color: '#e0716a' }}>{fmtCurrency(week.fuelCost)}</div><div className="lbl" style={{ color: '#a8938e' }}>Combustível</div></div>
              <div className="ub-stat"><div className="val" style={{ color: '#4a3634' }}>{fmtCurrency(week.contribution)}</div><div className="lbl" style={{ color: '#a8938e' }}>Líquido</div></div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#6b5450', marginBottom: 4 }}>
                <span>Meta líquida</span><span className="ub-mono">{pct.toFixed(0)}%</span>
              </div>
              <div style={{ background: '#f5e6e1', borderRadius: 999, overflow: 'hidden', height: 8 }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: '#a8544a', animation: 'fillBar .9s cubic-bezier(.2,.8,.2,1)' }} />
              </div>
            </div>
          </div>
        )}

        {tab === 'sessions' && (
          <>
            {sessions.length === 0 && <div className="ub-card"><div style={{ fontSize: 12.5, color: '#6b5450' }}>Nenhuma sessão registrada ainda.</div></div>}
            {sessions.map(s => {
              const calc = calcSession(s);
              return (
                <div key={s.id} className="ub-card">
                  <div className="ub-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#4a3634' }}>{s.date}</div>
                      <div style={{ fontSize: 11, color: '#a8938e' }}>{s.startedAt} → {s.endedAt} · {calc.durationHours.toFixed(1)}h · {calc.totalKm.toFixed(0)}km</div>
                    </div>
                    <span className="ub-mono" style={{ fontSize: 14, fontWeight: 800, color: '#7fb88f' }}>{fmtCurrency(calc.contribution)}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'settings' && (
          <>
            <div className="ub-card">
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a6f6a', textTransform: 'uppercase', marginBottom: 10 }}>🎯 Meta semanal</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label className="ub-label">Meta líquida (R$)</label><input type="number" className="ub-input" value={settings.weeklyNetGoal} onChange={e => setSettings(s => ({...s, weeklyNetGoal: parseNum(e.target.value)}))} /></div>
                <div style={{ flex: 1 }}><label className="ub-label">Aluguel semanal (R$)</label><input type="number" className="ub-input" value={settings.weeklyRent} onChange={e => setSettings(s => ({...s, weeklyRent: parseNum(e.target.value)}))} /></div>
              </div>
            </div>
            <div className="ub-card">
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a6f6a', textTransform: 'uppercase', marginBottom: 10 }}>⛽ Combustível</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label className="ub-label">Etanol (R$/L)</label><input type="number" step="0.01" className="ub-input" value={settings.fuelPricePerLiter} onChange={e => setSettings(s => ({...s, fuelPricePerLiter: parseNum(e.target.value)}))} /></div>
                <div style={{ flex: 1 }}><label className="ub-label">Consumo (km/L)</label><input type="number" step="0.1" className="ub-input" value={settings.consumptionKmPerLiter} onChange={e => setSettings(s => ({...s, consumptionKmPerLiter: parseNum(e.target.value)}))} /></div>
              </div>
            </div>
            <div className="ub-card">
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a6f6a', textTransform: 'uppercase', marginBottom: 10 }}>🏭 Escala CLT</div>
              <label className="ub-label">Data ancora (1º dia de trabalho do ciclo)</label>
              <input type="date" className="ub-input" value={settings.cltSchedule.anchorDate} onChange={e => setSettings(s => ({...s, cltSchedule: {...s.cltSchedule, anchorDate: e.target.value}}))} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1 }}><label className="ub-label">Início turno</label><input type="time" className="ub-input" value={settings.cltSchedule.shiftStart} onChange={e => setSettings(s => ({...s, cltSchedule: {...s.cltSchedule, shiftStart: e.target.value}}))} /></div>
                <div style={{ flex: 1 }}><label className="ub-label">Fim turno</label><input type="time" className="ub-input" value={settings.cltSchedule.shiftEnd} onChange={e => setSettings(s => ({...s, cltSchedule: {...s.cltSchedule, shiftEnd: e.target.value}}))} /></div>
              </div>
            </div>
            <button className="ub-btn" onClick={() => saveSettings(settings)}>Salvar ajustes</button>
          </>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<UberRoutine />);
