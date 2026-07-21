const { useState, useEffect, useCallback, useRef, useMemo } = React;

const UBER_DAY_MS = 86400000;
const UBER_STORAGE_KEY = 'jornada_uber_data_v1';

const DEFAULT_UBER_DATA = {
  settings: {
    weeklyNetGoal: 200, weeklyRent: 590, weeklyExtraCosts: 0, fuelPricePerLiter: 4.99, consumptionKmPerLiter: 12,
    averageGrossPerHour: 40, averageGrossPerPaidKm: 1.10,
    restRules: { minimumSleepHours: 7, postCltBufferHours: 2, maximumUberHoursPerDay: 6 },
    cltSchedule: { anchorDate: '', shiftStart: '18:00', shiftEnd: '05:00', patternType: '2x2_3x3', pattern: [] }
  },
  sessions: [],
  overrides: []
};

const OPPORTUNITY_EVENTS = [
  { id: 'arena-brb', name: 'Arena BRB - Grandes eventos', venue: 'Arena BRB Mane Garrincha', area: 'Brasilia - DF', demand: 'high', surge: '2.0x - 3.0x', bestTimes: ['18:00','19:00','20:00','22:30','23:00'], goodTimes: ['17:00','21:00','23:30'] },
  { id: 'aeroporto-jk', name: 'Aeroporto JK - Chegadas', venue: 'Aeroporto de Brasilia', area: 'Brasilia - DF', demand: 'high', surge: '2.0x - 3.0x', bestTimes: ['10:30','11:30','16:30','17:30','20:30'], goodTimes: ['10:00','11:00','16:00','17:00','20:00'] },
  { id: 'asa-norte', name: 'Asa Norte - bares noturnos', venue: '209/Concha Acustica', area: 'Asa Norte - DF', demand: 'high', surge: '1.8x - 2.5x', bestTimes: ['21:00','22:00','23:00','00:00'], goodTimes: ['20:00','01:00'] },
  { id: 'rodoviaria', name: 'Rodoviaria do Plano Piloto', venue: 'Rodoviaria de Brasilia', area: 'Brasilia - DF', demand: 'high', surge: '2.0x - 3.0x', bestTimes: ['06:00','07:00','08:00','17:00','18:00','19:00'], goodTimes: ['05:00','09:00','16:00','20:00'] },
  { id: 'brasilia-shopping', name: 'Brasilia Shopping', venue: 'Brasilia Shopping', area: 'Brasilia - DF', demand: 'medium', surge: '1.5x - 2.0x', bestTimes: ['10:00','11:00','14:00','15:00'], goodTimes: ['09:00','12:00','16:00'] },
  { id: 'feira-ceilandia', name: 'Feira da Ceilandia', venue: 'Ceilandia Centro', area: 'Ceilandia - DF', demand: 'medium', surge: '1.8x - 2.2x', bestTimes: ['08:00','09:00','10:00'], goodTimes: ['07:00','11:00'] },
  { id: 'taguatinga', name: 'Taguatinga Shopping - Cinema', venue: 'Taguatinga Shopping', area: 'Taguatinga - DF', demand: 'medium', surge: '1.3x - 1.8x', bestTimes: ['19:00','20:00','21:00'], goodTimes: ['18:00','22:00'] },
  { id: 'shoppings-plano', name: 'Shoppings do Plano Piloto', venue: 'Conjunto Nacional', area: 'Brasilia - DF', demand: 'medium', surge: '1.4x - 1.9x', bestTimes: ['12:00','13:00','18:00','19:00'], goodTimes: ['11:00','14:00','17:00','20:00'] },
  { id: 'parque-cidade', name: 'Parque da Cidade - Domingo', venue: 'Parque da Cidade', area: 'Brasilia - DF', demand: 'normal', surge: '1.0x - 1.2x', bestTimes: ['08:00','09:00','16:00'], goodTimes: ['07:00','10:00','17:00'] },
  { id: 'forum-unb', name: 'Forum de Direito - UNB', venue: 'Universidade de Brasilia', area: 'Brasilia - DF', demand: 'normal', surge: '1.0x - 1.3x', bestTimes: ['08:00','09:00','12:00','13:00'], goodTimes: ['07:00','10:00','11:00'] },
];

const DEMAND_META = { high: { label: 'Alta', icon: '\uD83D\uDD25', color: '#e0716a', order: 0 }, medium: { label: 'Media', icon: '\uD83D\uDCC8', color: '#e0a24a', order: 1 }, normal: { label: 'Normal', icon: '\uD83D\uDCCA', color: '#7f9fc9', order: 2 } };
const REC_STATES = {
  opportunity: { cor: '#7fb88f', titulo: 'Boa oportunidade', icone: '\uD83D\uDE97' },
  clt_day: { cor: '#e0a24a', titulo: 'Dia de CLT', icone: '\uD83C\uDFED' },
  goal_reached: { cor: '#a87fd9', titulo: 'Meta atingida', icone: '\uD83C\uDF89' },
  insufficient_data: { cor: '#a8938e', titulo: 'Configure a escala', icone: '\u2699\uFE0F' },
  rest_first: { cor: '#e0a24a', titulo: 'Priorize descanso', icone: '\uD83D\uDECF' }
};

function loadUberData() {
  try { return JSON.parse(localStorage.getItem(UBER_STORAGE_KEY)) || JSON.parse(JSON.stringify(DEFAULT_UBER_DATA)); }
  catch(e) { return JSON.parse(JSON.stringify(DEFAULT_UBER_DATA)); }
}
function saveUberData(data) {
  try { localStorage.setItem(UBER_STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function normalizeDate(v) { const d = v instanceof Date ? v : new Date((v || getTodayStr()) + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
function fmtDate(d) { return normalizeDate(d).toISOString().split('T')[0]; }
function dateOffset(ds, days) { const d = normalizeDate(ds); d.setDate(d.getDate() + days); return fmtDate(d); }
function timeToMin(t) { const [h,m] = String(t||'00:00').split(':').map(Number); return (h||0)*60+(m||0); }
function minToTime(m) { const n = ((Math.round(m)%1440)+1440)%1440; return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
function addHours(time, hours) { const [h,m] = time.split(':').map(Number); return minToTime(h*60+m+Math.round(hours*60)); }
function fmtCurrency(v) { return 'R$ ' + Number(v||0).toFixed(2).replace('.',','); }
function parseNum(v) { if(typeof v==='number')return v; const n=parseFloat(String(v||'').replace(',','.').trim()); return Number.isFinite(n)?n:0; }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDuration(ms) { const s=Math.max(0,Math.floor((Number(ms)||0)/1000)); return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor((s%3600)/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function fmtCompactDuration(ms) { const t=Math.floor(Math.max(0,Number(ms)||0)/60000); if(t>=60)return Math.floor(t/60)+'h'+String(t%60).padStart(2,'0')+'m'; return t+'m'; }
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function schedulePattern(s) {
  if ((s.patternType||'2x2_3x3')==='2x2_3x3') return ['work','work','off','off','work','work','work','off','off','off'];
  if (s.patternType==='3x2') return ['work','work','work','off','off'];
  return ['work','work','off','off','work','work','work','off','off','off'];
}
function scheduleLabel(s) {
  const sig = schedulePattern(s).join(',');
  if (sig==='work,work,off,off,work,work,work,off,off,off') return '2x2 + 3x3';
  if (sig==='work,work,work,off,off') return '3x2';
  return 'Personalizada';
}

function getScheduleDay(targetDate, settings, overrides) {
  const ds = fmtDate(targetDate);
  const ov = (overrides||[]).find(o => o.date === ds);
  if (ov) return { type: ov.overrideType, cycleIndex: null, isWorkDay: ov.overrideType==='work', isOffDay: ov.overrideType==='off' };
  if (!settings.cltSchedule.anchorDate) return { type: 'unknown', cycleIndex: null, isWorkDay: false, isOffDay: false };
  const diff = Math.round((normalizeDate(targetDate).getTime() - normalizeDate(settings.cltSchedule.anchorDate).getTime()) / UBER_DAY_MS);
  const pat = schedulePattern(settings.cltSchedule);
  const idx = ((diff % pat.length) + pat.length) % pat.length;
  const type = pat[idx];
  return { type, cycleIndex: idx, isWorkDay: type==='work', isOffDay: type==='off' };
}

function restReadyAfterPreviousShift(dateStr, settings, overrides) {
  const previousDate = dateOffset(dateStr, -1);
  const previousDay = getScheduleDay(previousDate, settings, overrides);
  const shiftEnd = timeToMin(settings.cltSchedule.shiftEnd);
  const shiftStart = timeToMin(settings.cltSchedule.shiftStart);
  if (!previousDay.isWorkDay || !(shiftEnd <= shiftStart)) return null;
  const sleepMin = Math.max(0, Number(settings.restRules.minimumSleepHours||0))*60;
  const bufferMin = Math.max(0, Number(settings.restRules.postCltBufferHours||0))*60;
  const readyMin = shiftEnd + bufferMin + sleepMin;
  return { previousDate, shiftEnd: settings.cltSchedule.shiftEnd, bufferHours: settings.restRules.postCltBufferHours||0, sleepHours: settings.restRules.minimumSleepHours, readyAt: minToTime(readyMin), readyMinutes: readyMin };
}

function weekStart(ds) { const d=normalizeDate(ds); const day=d.getDay(); const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return d; }
function weekId(ds) { const s=weekStart(ds); const ys=new Date(s.getFullYear(),0,1,12); const w=Math.ceil((((s-ys)/UBER_DAY_MS)+ys.getDay()+1)/7); return s.getFullYear()+'-W'+String(w).padStart(2,'0'); }

function weekSummary(dateStr, sessions, settings) {
  const start = weekStart(dateStr);
  const end = new Date(start.getTime() + 6 * UBER_DAY_MS);
  const filtered = sessions.filter(s => { const d = normalizeDate(s.date); return d >= start && d <= end; });
  const grossRevenue = filtered.reduce((sum,x) => sum + parseNum(x.grossRevenue), 0);
  const totalKm = filtered.reduce((sum,x) => sum + parseNum(x.distanceKm||0), 0);
  const totalHours = filtered.reduce((sum,x) => {
    const [sh,sm]=String(x.startedAt||'00:00').split(':').map(Number);
    const [eh,em]=String(x.endedAt||'00:00').split(':').map(Number);
    let min=(eh*60+em)-(sh*60+sm); if(min<0)min+=1440;
    return sum + min/60;
  }, 0);
  const fuelCost = (totalKm / (settings.consumptionKmPerLiter||12)) * (settings.fuelPricePerLiter||4.99);
  const contribution = grossRevenue - fuelCost;
  const netProfit = contribution - (settings.weeklyRent||0) - (settings.weeklyExtraCosts||0);
  const remaining = Math.max(0, (settings.weeklyNetGoal||200) - netProfit);
  const progress = Math.min(100, Math.max(0, (netProfit / (settings.weeklyNetGoal||200)) * 100));
  return { id: weekId(dateStr), sessions: filtered, grossRevenue, fuelCost, totalKm, totalHours, contribution, netProfit, remaining, progress, contributionPerHour: totalHours > 0 ? contribution/totalHours : 0 };
}

function defaultContributionPerHour(settings) {
  const costPerKm = (settings.fuelPricePerLiter||4.99) / (settings.consumptionKmPerLiter||12);
  const paidKmPerHour = (settings.averageGrossPerHour||40) / (settings.averageGrossPerPaidKm||1.10);
  return (settings.averageGrossPerHour||40) - (paidKmPerHour * costPerKm);
}

function getRecommendation(dateStr, sessions, settings, overrides) {
  const week = weekSummary(dateStr, sessions, settings);
  const scheduleDay = getScheduleDay(dateStr, settings, overrides);
  const perHour = defaultContributionPerHour(settings);
  if (!settings.cltSchedule.anchorDate) return { state:'insufficient_data', shouldDrive:false, title:'Configure a escala', message:'Informe uma data conhecida do primeiro dia de trabalho do ciclo.' };
  if (week.remaining <= 0) return { state:'goal_reached', shouldDrive:false, title:'Meta atingida', message:'A meta semanal ja foi concluida. Preserve sua folga.' };
  if (scheduleDay.isWorkDay) return { state:'clt_day', shouldDrive:false, title:'Dia de CLT', message:'Evite sessao longa antes do turno das '+settings.cltSchedule.shiftStart+' as '+settings.cltSchedule.shiftEnd+'.' };
  const rawHours = week.remaining / Math.max(1, perHour);
  const restReady = restReadyAfterPreviousShift(dateStr, settings, overrides);
  const baseStartMin = timeToMin('09:30');
  const startMin = Math.max(baseStartMin, restReady?.readyMinutes || 0);
  const latestEndMin = timeToMin('22:00');
  const availableHours = Math.max(0, (latestEndMin - startMin) / 60);
  const recommendedHours = Math.min(settings.restRules.maximumUberHoursPerDay||6, Math.ceil(rawHours*2)/2, availableHours);
  if (recommendedHours < 1) return { state:'rest_first', shouldDrive:false, title:'Priorize descanso', message: restReady ? 'Turno anterior terminou as '+restReady.shiftEnd+'. Com '+restReady.bufferHours+'h pausa pos-CLT e '+restReady.sleepHours+'h sono, seguro a partir de '+restReady.readyAt+'. Nao sobra janela boa hoje.' : 'Nao sobra janela boa hoje sem apertar o descanso.' };
  const startAt = minToTime(startMin);
  const endAt = addHours(startAt, recommendedHours);
  return { state:'opportunity', shouldDrive:true, title: restReady ? 'Depois do descanso' : 'Boa oportunidade', message: restReady ? 'Turno terminou as '+restReady.shiftEnd+'. Respeitando '+restReady.bufferHours+'h pos-CLT e '+restReady.sleepHours+'h sono, janela comeca as '+startAt+'.' : 'Folga com meta em aberto. Rode sem comprometer o descanso.', recommendedHours, startAt, endAt, expectedContribution: recommendedHours * perHour, expectedGross: recommendedHours * (settings.averageGrossPerHour||40) };
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

function opportunityTimeInfo(event) {
  const now = new Date();
  const currentMin = now.getHours()*60 + now.getMinutes();
  const times = [...event.bestTimes.map(t=>({time:t,best:true})), ...event.goodTimes.map(t=>({time:t,best:false}))];
  let live = false, soon = false, next = null;
  times.forEach(slot => {
    const minutes = timeToMin(slot.time);
    let diff = minutes - currentMin;
    if (minutes < 180 && currentMin > 1260) diff += 1440;
    if (diff >= -30 && diff <= 60) live = true;
    if (diff > 60 && diff <= 180) soon = true;
    if (diff >= -30 && (!next || diff < next.diff)) next = { ...slot, diff };
  });
  return { live, soon, nextTime: next?.time || event.bestTimes[0] };
}

function getActiveOpportunities() {
  return OPPORTUNITY_EVENTS
    .map(ev => ({ ...ev, timeInfo: opportunityTimeInfo(ev) }))
    .filter(ev => ev.timeInfo.live || ev.timeInfo.soon)
    .sort((a,b) => DEMAND_META[a.demand].order - DEMAND_META[b.demand].order)
    .slice(0, 3);
}

function Sheet({ title, children, actionLabel, onAction, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(74,54,52,.35)', zIndex:120, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fffdfc', borderRadius:'24px 24px 0 0', padding:'24px 24px 28px', width:'100%', maxWidth:420, maxHeight:'85vh', overflowY:'auto', animation:'sheetUp .28s cubic-bezier(.2,.8,.2,1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'#f0ddd6', borderRadius:999, margin:'0 auto 16px' }} />
        <div className="ub-serif" style={{ fontSize:18, fontWeight:600, color:'#4a3634', marginBottom:14 }}>{title}</div>
        {children}
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button className="ub-btn-outline" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="ub-btn" style={{ flex:2 }} onClick={onAction}>{actionLabel}</button>
        </div>
      </div>
    </div>
  );
}

function UberRoutine() {
  const [tab, setTab] = useState('today');
  const [settings, setSettings] = useState(DEFAULT_UBER_DATA.settings);
  const [sessions, setSessions] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [erro, setErro] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [opFilter, setOpFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef(null);
  const geoRef = useRef(null);
  const lastPosRef = useRef(null);
  const [timer, setTimer] = useState({ running:false, startMs:null, elapsed:0, paused:false, laps:[], lastLapMs:0, liveKm:0, gpsActive:false });
  const [liveEvents, setLiveEvents] = useState([]);

  useEffect(() => {
    const data = loadUberData();
    setSettings(data.settings);
    setSessions(data.sessions || []);
    setOverrides(data.overrides || []);
  }, []);

  useEffect(() => { saveUberData({ settings, sessions, overrides }); }, [settings, sessions, overrides]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (timer.running && !timer.paused) {
      timerRef.current = setInterval(() => setTimer(prev => ({ ...prev, elapsed: Date.now() - prev.startMs })), 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [timer.running, timer.paused]);

  useEffect(() => { setLiveEvents(getActiveOpportunities()); }, [now]);

  function startGps() {
    if (!navigator.geolocation) return;
    lastPosRef.current = null;
    geoRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        if (lastPosRef.current) {
          const d = haversine(lastPosRef.current.lat, lastPosRef.current.lon, lat, lon);
          if (d > 0.005 && d < 5) setTimer(prev => ({ ...prev, liveKm: (prev.liveKm||0) + d, gpsActive: true }));
        }
        lastPosRef.current = { lat, lon };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    setTimer(prev => ({ ...prev, gpsActive: true }));
  }
  function stopGps() {
    if (geoRef.current !== null) { navigator.geolocation.clearWatch(geoRef.current); geoRef.current = null; }
    lastPosRef.current = null;
    setTimer(prev => ({ ...prev, gpsActive: false }));
  }

  function startTimer() { setTimer({ running:true, startMs:Date.now(), elapsed:0, paused:false, laps:[], lastLapMs:0, liveKm:0, gpsActive:false }); setTab('sessions'); startGps(); }
  function pauseTimer() { setTimer(prev => ({ ...prev, paused:true })); stopGps(); }
  function resumeTimer() { setTimer(prev => ({ ...prev, paused:false, startMs: Date.now()-prev.elapsed })); startGps(); }
  function lapTimer() { setTimer(prev => { const el=Date.now()-prev.startMs; return { ...prev, laps:[...prev.laps, { atMs:el, lapMs: el-prev.lastLapMs, km: prev.liveKm }], lastLapMs: el }; }); }
  function resetTimer() { stopGps(); setTimer({ running:false, startMs:null, elapsed:0, paused:false, laps:[], lastLapMs:0, liveKm:0, gpsActive:false }); }
  function finishTimer() {
    if (timer.elapsed < 60000) { alert('Rode pelo menos 1 minuto antes de finalizar'); return; }
    const start = new Date(timer.startMs), end = new Date();
    const startedAt = String(start.getHours()).padStart(2,'0')+':'+String(start.getMinutes()).padStart(2,'0');
    const endedAt = String(end.getHours()).padStart(2,'0')+':'+String(end.getMinutes()).padStart(2,'0');
    const km = timer.liveKm > 0 ? Math.round(timer.liveKm * 10) / 10 : '';
    stopGps();
    setTimer({ running:false, startMs:null, elapsed:0, paused:false, laps:[], lastLapMs:0, liveKm:0, gpsActive:false });
    openSessionSheet(startedAt, endedAt, fmtDate(start), 'Cronometro: '+fmtDuration(timer.elapsed), null, km);
  }

  function openSessionSheet(s,e,d,n,eid,km) { setSheet({ type:'session', startAt:s||'09:30', endAt:e||'14:00', date:d||getTodayStr(), notes:n||'', editId:eid||null, liveKm:km||'' }); }
  function openScheduleSheet() { setSheet({ type:'schedule' }); }
  function openOverrideSheet() { setSheet({ type:'override' }); }
  function openSessionDetail(s) { setSheet({ type:'detail', session:s }); }

  function addSession(session) {
    const id = session.id || (session.date+'_'+Date.now());
    setSessions(prev => { const idx = prev.findIndex(s => s.id === id); return idx >= 0 ? prev.map((s,i) => i===idx ? {...session,id} : s) : [{...session,id}, ...prev]; });
  }
  function removeSession(id) { setSessions(prev => prev.filter(s => s.id !== id)); }
  function addOverride(ov) { setOverrides(prev => { const idx = prev.findIndex(o => o.date === ov.date); return idx >= 0 ? prev.map((o,i) => i===idx ? ov : o) : [...prev, ov]; }); }
  function removeOverride(date) { setOverrides(prev => prev.filter(o => o.date !== date)); }

  const today = getTodayStr();
  const week = weekSummary(today, sessions, settings);
  const rec = getRecommendation(today, sessions, settings, overrides);
  const recState = REC_STATES[rec.state] || REC_STATES.insufficient_data;
  const pct = Math.max(0, Math.min(100, week.progress));

  const filteredOpps = useMemo(() => {
    return OPPORTUNITY_EVENTS
      .filter(ev => opFilter==='all' || ev.demand===opFilter)
      .map(ev => ({ ...ev, timeInfo: opportunityTimeInfo(ev) }))
      .sort((a,b) => { if (a.timeInfo.live!==b.timeInfo.live) return a.timeInfo.live?-1:1; if (a.timeInfo.soon!==b.timeInfo.soon) return a.timeInfo.soon?-1:1; return DEMAND_META[a.demand].order-DEMAND_META[b.demand].order; });
  }, [opFilter, now]);

  return (
    <div style={{ minHeight:'100vh', background:'#faf1ee', padding:'24px 14px 60px', display:'flex', justifyContent:'center' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;}body{margin:0;background:#faf1ee;}
        .ub-root{font-family:'Nunito',sans-serif;width:100%;max-width:420px;display:flex;flex-direction:column;gap:16px;}
        .ub-serif{font-family:'Fraunces',serif;}
        .ub-mono{font-family:'JetBrains Mono',monospace;}
        @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
        @keyframes fillBar{from{width:0%;}}
        @keyframes sheetUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
        @keyframes popIcon{0%{transform:scale(.6) rotate(-8deg);opacity:0;}60%{transform:scale(1.12) rotate(3deg);opacity:1;}100%{transform:scale(1) rotate(0);opacity:1;}}
        .ub-card{background:#fffdfc;border-radius:20px;border:1.5px solid #f0ddd6;box-shadow:0 2px 12px rgba(180,120,110,.07);padding:16px;}
        .ub-spotlight{position:relative;overflow:hidden;padding:20px;border-radius:24px;}
        .ub-spotlight::before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.18) 45%,transparent 60%);background-size:200% 100%;animation:shimmer 3.2s ease-in-out infinite;pointer-events:none;}
        .ub-bar-track{background:rgba(255,255,255,.35);border-radius:999px;overflow:hidden;height:7px;}
        .ub-bar-fill{height:100%;border-radius:999px;background:white;animation:fillBar .9s cubic-bezier(.2,.8,.2,1);}
        .ub-bar-track-dark{background:#f5e6e1;border-radius:999px;overflow:hidden;}
        .ub-bar-fill-dark{height:100%;border-radius:999px;background:#a8544a;animation:fillBar .9s cubic-bezier(.2,.8,.2,1);}
        .ub-stat{flex:1;text-align:center;padding:10px 4px;}
        .ub-stat .val{font-size:17px;font-weight:800;font-family:'JetBrains Mono',monospace;}
        .ub-stat .lbl{font-size:10px;font-weight:700;margin-top:2px;text-transform:uppercase;}
        .ub-chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:700;border:1.5px solid #f0ddd6;background:#fffdfc;color:#8a6f6a;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:'Nunito',sans-serif;}
        .ub-chip.active{background:#a8544a;border-color:#a8544a;color:white;}
        .ub-tablist{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;}
        .ub-tablist::-webkit-scrollbar{display:none;}
        .ub-btn{border:none;background:#a8544a;color:white;font-weight:800;border-radius:14px;padding:12px;font-size:14px;cursor:pointer;width:100%;font-family:'Nunito',sans-serif;}
        .ub-btn:active{transform:scale(0.97);}
        .ub-btn-outline{border:1.5px solid #f0ddd6;background:#fffdfc;color:#8a6f6a;font-weight:800;border-radius:14px;padding:12px;font-size:14px;cursor:pointer;width:100%;font-family:'Nunito',sans-serif;}
        .ub-btn-danger{border:1.5px solid #e0716a55;background:#fffdfc;color:#b85d55;font-weight:800;border-radius:14px;padding:12px;font-size:14px;cursor:pointer;width:100%;font-family:'Nunito',sans-serif;}
        .ub-input{width:100%;border:1.5px solid #f0ddd6;border-radius:12px;padding:10px 13px;font-family:'Nunito',sans-serif;font-size:13.5px;color:#4a3634;outline:none;background:#fffdfc;}
        .ub-input:focus{border-color:#a8544a;}
        .ub-label{font-size:11px;font-weight:700;color:#8a6f6a;margin-bottom:4px;display:block;}
        .ub-row{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #f5e6e1;}
        .ub-row:last-child{border-bottom:none;}
        .ub-row-between{display:flex;justify-content:space-between;align-items:center;}
        .ub-event{padding:14px;border-left:4px solid var(--ec);display:flex;flex-direction:column;gap:8px;}
        .ub-time-slot{font-size:11.5px;font-weight:800;border-radius:999px;padding:5px 9px;background:#f8ebe7;color:#8a6f6a;}
        .ub-time-slot.best{background:#e8f3ec;color:#4b9564;}
        .ub-demand{border-radius:999px;padding:4px 9px;font-size:10.5px;font-weight:900;color:var(--dc);background:#fff4ef;white-space:nowrap;}
        .ub-tip{font-size:11px;color:#a8938e;line-height:1.4;margin-top:6px;}
        .ub-live-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#e0716a;color:white;font-size:10px;font-weight:900;padding:3px 8px;}
        .ub-timer-display{font-family:'JetBrains Mono',monospace;font-size:38px;font-weight:800;color:#a8544a;text-align:center;}
        .ub-timer-status{font-size:10.5px;font-weight:900;border-radius:999px;padding:4px 9px;background:#f8ebe7;color:#8a6f6a;}
        .ub-timer-status.running{background:#e8f3ec;color:#4b9564;}
        .ub-timer-status.paused{background:#fff5df;color:#b77c20;}
        .ub-schedule-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5e6e1;}
        .ub-schedule-item:last-child{border-bottom:none;}
        .ub-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px;}
        .ub-cal-day{text-align:center;padding:6px 2px;border-radius:8px;font-size:11px;font-weight:700;}
        .ub-cal-day.today{border:2px solid #a8544a;}
      `}</style>

      <div className="ub-root">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <a href="/hub.html" style={{ fontSize:13, color:'#a8938e', fontWeight:700, textDecoration:'none' }}>{'\u2190'} voltar ao hub</a>
          <div className="ub-serif" style={{ fontSize:20, fontWeight:600, color:'#4a3634' }}>Rotina Uber</div>
          {tab==='sessions' ? <button onClick={() => openSessionSheet()} style={{ width:42, height:42, borderRadius:14, background:'#a8544a', color:'white', border:'none', fontSize:24, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 18px rgba(168,84,74,.22)' }}>+</button> : <div />}
        </div>

        <div className="ub-tablist">
          {[['today','Hoje'],['opportunities','Oportunidades'],['schedule','Escala'],['week','Semana'],['sessions','Sessoes'],['analysis','Analise'],['settings','Ajustes']].map(([id,label]) => (
            <button key={id} className={`ub-chip ${tab===id?'active':''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'today' && (<>
          <div className="ub-spotlight" style={{ background:`linear-gradient(135deg, ${recState.cor}, ${recState.cor}cc)` }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.85)', fontWeight:800, textTransform:'uppercase', letterSpacing:.4 }}>{week.id}</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:8 }}>
              <span style={{ fontSize:30, animation:'popIcon .5s ease' }}>{recState.icone}</span>
              <span className="ub-serif" style={{ color:'white', fontSize:19, fontWeight:600 }}>{rec.title || recState.titulo}</span>
            </div>
            <div style={{ color:'rgba(255,255,255,.92)', fontSize:13, marginTop:8, lineHeight:1.4 }}>{escHtml(rec.message||'')}</div>
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,.9)', marginBottom:4 }}>
                <span>Meta liquida semanal</span>
                <span className="ub-mono" style={{ fontWeight:700 }}>{fmtCurrency(week.netProfit)} / {fmtCurrency(settings.weeklyNetGoal)}</span>
              </div>
              <div className="ub-bar-track"><div className="ub-bar-fill" style={{ width:`${pct}%` }} /></div>
            </div>
            <div style={{ display:'flex', marginTop:16, background:'rgba(255,255,255,.18)', borderRadius:14, padding:4 }}>
              <div className="ub-stat"><div className="val" style={{ color:'white' }}>{fmtCurrency(week.remaining)}</div><div className="lbl" style={{ color:'rgba(255,255,255,.8)' }}>Faltam</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'white' }}>{rec.recommendedHours ? Number(rec.recommendedHours).toFixed(1).replace('.0','') : '0'}h</div><div className="lbl" style={{ color:'rgba(255,255,255,.8)' }}>Estimado</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'white' }}>{rec.startAt || '\u2014'}</div><div className="lbl" style={{ color:'rgba(255,255,255,.8)' }}>Comecar</div></div>
            </div>
          </div>

          {liveEvents.length > 0 ? (
            <div className="ub-card" style={{ padding:14, borderLeft:`4px solid ${DEMAND_META[liveEvents[0].demand].color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13.5, fontWeight:800, color:'#4a3634' }}>Eventos ativos</span>
                    {liveEvents.some(e => e.timeInfo.live) && <span className="ub-live-pill">AO VIVO</span>}
                  </div>
                  <div style={{ fontSize:11.5, color:'#a8938e', marginTop:3 }}>{liveEvents.length} oportunidade(s) proximas. Melhor agora: {escHtml(liveEvents[0].name)} - {liveEvents[0].timeInfo.nextTime}</div>
                </div>
                <button className="ub-btn-outline" style={{ width:'auto', padding:'8px 12px', fontSize:12 }} onClick={() => setTab('opportunities')}>Ver</button>
              </div>
            </div>
          ) : (
            <div className="ub-card" style={{ padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:800, color:'#4a3634' }}>Oportunidades do dia</div>
                  <div style={{ fontSize:11.5, color:'#a8938e', marginTop:2 }}>Nenhum pico proximo agora. Veja a lista para planejar.</div>
                </div>
                <button className="ub-btn-outline" style={{ width:'auto', padding:'8px 12px', fontSize:12 }} onClick={() => setTab('opportunities')}>Ver</button>
              </div>
            </div>
          )}

          {timer.running && (
            <button className="ub-card" style={{ padding:14, textAlign:'left', width:'100%', borderColor:'#7fb88f55', cursor:'pointer' }} onClick={() => setTab('sessions')}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:800, color:'#4a3634' }}>Cronometro {timer.paused ? 'pausado' : 'rodando'}</div>
                  <div style={{ fontSize:11.5, color:'#a8938e', marginTop:2 }}>{fmtCompactDuration(timer.elapsed)} em andamento</div>
                </div>
                <span className="ub-mono" style={{ fontSize:14, fontWeight:800, color:'#7fb88f' }}>{fmtDuration(timer.elapsed)}</span>
              </div>
            </button>
          )}

          {rec.shouldDrive ? <button className="ub-btn" onClick={() => openSessionSheet(rec.startAt, rec.endAt, today, '')}>Iniciar sessao sugerida ({rec.startAt} - {rec.endAt})</button> : <button className="ub-btn" onClick={() => setTab('settings')}>Ajustar plano</button>}
        </>)}

        {tab === 'opportunities' && (<>
          <div className="ub-card" style={{ padding:16 }}>
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:8 }}>Oportunidades DF e entorno</div>
            <div style={{ fontSize:13, color:'#4a3634' }}>Pontos de demanda estimados. Estrela = melhores horarios.</div>
            <div className="ub-tablist" style={{ marginTop:12 }}>
              {[['all','Todas',OPPORTUNITY_EVENTS.length],['high','Alta',OPPORTUNITY_EVENTS.filter(e=>e.demand==='high').length],['medium','Media',OPPORTUNITY_EVENTS.filter(e=>e.demand==='medium').length],['normal','Normal',OPPORTUNITY_EVENTS.filter(e=>e.demand==='normal').length]].map(([id,label,count]) => (
                <button key={id} className={`ub-chip ${opFilter===id?'active':''}`} onClick={() => setOpFilter(id)}>{label} . {count}</button>
              ))}
            </div>
          </div>
          {filteredOpps.map(ev => {
            const meta = DEMAND_META[ev.demand];
            return (
              <div key={ev.id} className="ub-card ub-event" style={{ '--ec':meta.color }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                  <div>
                    <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ fontSize:14.5, fontWeight:800, color:'#4a3634' }}>{ev.name}</div>
                      {ev.timeInfo.live && <span className="ub-live-pill">AO VIVO</span>}
                      {!ev.timeInfo.live && ev.timeInfo.soon && <span className="ub-demand" style={{ '--dc':meta.color }}>Em breve</span>}
                    </div>
                    <div style={{ fontSize:11.5, color:'#a8938e', marginTop:4 }}>{ev.venue} - {ev.area}</div>
                  </div>
                  <span className="ub-demand" style={{ '--dc':meta.color }}>{meta.icon} {meta.label}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center' }}>
                  <div style={{ fontSize:13, color:'#4a3634' }}><b>Surge:</b> {ev.surge}</div>
                  <div style={{ fontSize:11.5, color:'#a8938e' }}>Proximo: {ev.timeInfo.nextTime}</div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {ev.bestTimes.map(t => <span key={t} className="ub-time-slot best">{'\u2B50'} {t}</span>)}
                  {ev.goodTimes.map(t => <span key={t} className="ub-time-slot">{t}</span>)}
                </div>
              </div>
            );
          })}
        </>)}

        {tab === 'schedule' && (<>
          <div className="ub-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase' }}>Escala CLT</div>
              <button onClick={openScheduleSheet} style={{ background:'none', border:'none', color:'#a8544a', fontWeight:800, fontSize:13, cursor:'pointer' }}>Editar</button>
            </div>
            <div style={{ fontSize:14, color:'#4a3634', fontWeight:800 }}>Padrao: {scheduleLabel(settings.cltSchedule)}</div>
            <div style={{ fontSize:12, color:'#a8938e', marginTop:4 }}>Turno: {settings.cltSchedule.shiftStart} - {settings.cltSchedule.shiftEnd}</div>
            {settings.cltSchedule.anchorDate && <div style={{ fontSize:12, color:'#a8938e', marginTop:2 }}>Data ancora: {fmtDate(settings.cltSchedule.anchorDate)}</div>}
            <div className="ub-cal">
              {['S','T','Q','Q','S','S','D'].map((d,i) => <div key={i} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#a8938e' }}>{d}</div>)}
              {(() => {
                const days = [];
                const start = weekStart(today);
                for (let i = 0; i < 14; i++) {
                  const ds = dateOffset(fmtDate(start), i);
                  const sd = getScheduleDay(ds, settings, overrides);
                  const isToday = ds === today;
                  const bg = sd.type==='work'?'#e8f3ec':sd.type==='off'?'#f8ebe7':'#f5f5f5';
                  const fg = sd.type==='work'?'#4b9564':sd.type==='off'?'#a8938e':'#ccc';
                  days.push(<div key={i} className={`ub-cal-day ${isToday?'today':''}`} style={{ background:bg, color:fg }}>{new Date(ds+'T12:00:00').getDate()}</div>);
                }
                return days;
              })()}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:8, fontSize:11, color:'#a8938e' }}>
              <span>Trabalho</span><span>Folga</span><span>Hoje</span>
            </div>
          </div>
          <div className="ub-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase' }}>Excecoes</div>
              <button onClick={openOverrideSheet} style={{ background:'none', border:'none', color:'#a8544a', fontWeight:800, fontSize:13, cursor:'pointer' }}>+ Adicionar</button>
            </div>
            {overrides.length === 0 && <div style={{ fontSize:12, color:'#a8938e' }}>Nenhuma excecao registrada.</div>}
            {overrides.sort((a,b) => b.date.localeCompare(a.date)).map(ov => (
              <div key={ov.date} className="ub-schedule-item">
                <div>
                  <div style={{ fontSize:13, color:'#4a3634', fontWeight:700 }}>{fmtDate(ov.date)}</div>
                  <div style={{ fontSize:11, color:'#a8938e' }}>{ov.overrideType==='work'?'Trabalho':'Folga'}{ov.reason?' - '+ov.reason:''}</div>
                </div>
                <button onClick={() => removeOverride(ov.date)} style={{ background:'none', border:'none', color:'#e0716a', fontSize:16, cursor:'pointer' }}>x</button>
              </div>
            ))}
          </div>
        </>)}

        {tab === 'week' && (
          <div className="ub-card">
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:12 }}>Semana {week.id}</div>
            <div style={{ display:'flex' }}>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{fmtCurrency(week.grossRevenue)}</div><div className="lbl" style={{ color:'#a8938e' }}>Bruto</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'#e0716a' }}>{fmtCurrency(week.fuelCost)}</div><div className="lbl" style={{ color:'#a8938e' }}>Combustivel</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{fmtCurrency(week.contribution)}</div><div className="lbl" style={{ color:'#a8938e' }}>Liquido</div></div>
            </div>
            <div style={{ display:'flex', marginTop:12 }}>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{week.totalHours.toFixed(1)}h</div><div className="lbl" style={{ color:'#a8938e' }}>Horas</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{week.totalKm.toFixed(0)}</div><div className="lbl" style={{ color:'#a8938e' }}>KM</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'#7fb88f' }}>{fmtCurrency(week.netProfit)}</div><div className="lbl" style={{ color:'#a8938e' }}>Liquido</div></div>
            </div>
            <div style={{ marginTop:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'#6b5450', marginBottom:4 }}>
                <span>Meta liquida</span><span className="ub-mono">{pct.toFixed(0)}%</span>
              </div>
              <div className="ub-bar-track-dark" style={{ height:8 }}><div className="ub-bar-fill-dark" style={{ width:`${pct}%` }} /></div>
              <div style={{ fontSize:12, color:'#a8938e', marginTop:6 }}>{week.remaining > 0 ? 'Faltam '+fmtCurrency(week.remaining)+' para bater a meta' : 'Meta atingida!'}</div>
            </div>
          </div>
        )}

        {tab === 'sessions' && (<>
          <div className="ub-card" style={{ padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase' }}>Sessao Uber</div>
              <span className={`ub-timer-status ${timer.running&&!timer.paused?'running':timer.paused?'paused':''}`}>{timer.running?(timer.paused?'PAUSADO':'RODANDO'):'PARADO'}</span>
            </div>
            <div className="ub-timer-display">{fmtDuration(timer.elapsed)}</div>
            <div style={{ display:'flex', justifyContent:'center', gap:16, margin:'6px 0 14px' }}>
              <span style={{ fontSize:11.5, color:'#a8938e' }}>{timer.elapsed?fmtCompactDuration(timer.elapsed)+(timer.running&&!timer.paused?' em andamento':' registrado'):'Aguardando'}</span>
              {(timer.running||timer.paused||timer.liveKm>0) && <span style={{ fontSize:13, fontWeight:800, color:'#7fb88f', fontFamily:'JetBrains Mono' }}>{timer.liveKm>0?(timer.liveKm.toFixed(1)+' km'):'0.0 km'}{timer.gpsActive?' GPS':''}</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8 }}>
              {timer.running&&!timer.paused?<button className="ub-btn" onClick={pauseTimer}>Pausar</button>:timer.paused?<button className="ub-btn" onClick={resumeTimer}>Retomar</button>:<button className="ub-btn" onClick={startTimer}>Iniciar</button>}
              <button className="ub-btn-outline" onClick={lapTimer} disabled={!timer.running}>Volta</button>
              <button className="ub-btn-outline" onClick={resetTimer} disabled={!timer.running&&!timer.paused}>Zerar</button>
            </div>
            {timer.running && <button className="ub-btn-outline" style={{ marginTop:8, borderColor:'#e0716a55', color:'#b85d55' }} onClick={finishTimer}>Finalizar e lancar sessao</button>}
            {timer.laps.length > 0 && (<div style={{ marginTop:12 }}>
              {timer.laps.slice(-3).reverse().map((lap, idx) => (
                <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0' }}>
                  <span style={{ fontSize:12, color:'#a8938e' }}>Volta {timer.laps.length - idx}</span>
                  <span className="ub-mono" style={{ fontSize:13 }}>{fmtDuration(lap.lapMs)}{lap.km?' / '+lap.km.toFixed(1)+'km':''}</span>
                </div>
              ))}
            </div>)}
          </div>
          {sessions.length===0 && <div className="ub-card"><div style={{ fontSize:12.5, color:'#6b5450' }}>Nenhuma sessao registrada. Toque no + no topo.</div></div>}
          {sessions.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(s => {
            const calc = calcSession(s);
            const id = s.id || (s.date + s.startedAt);
            return (
              <div key={id} className="ub-card" style={{ padding:'12px 12px', cursor:'pointer' }} onClick={() => openSessionDetail(calc)}>
                <div className="ub-row" style={{ border:'none', padding:0 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'#4a3634' }}>{fmtDate(s.date)}</div>
                    <div style={{ fontSize:11, color:'#a8938e' }}>{s.startedAt} - {s.endedAt} . {calc.durationHours.toFixed(1)}h . {calc.totalKm.toFixed(0)}km</div>
                  </div>
                  <span className="ub-mono" style={{ fontSize:14, fontWeight:800, color:'#7fb88f' }}>{fmtCurrency(calc.contribution)}</span>
                </div>
              </div>
            );
          })}
        </>)}

        {tab === 'analysis' && (
          <div className="ub-card" style={{ padding:18 }}>
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:12 }}>Valeu a pena?</div>
            <div style={{ display:'flex' }}>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{week.totalHours.toFixed(1)}h</div><div className="lbl" style={{ color:'#a8938e' }}>Horas</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{week.totalKm.toFixed(0)}</div><div className="lbl" style={{ color:'#a8938e' }}>KM</div></div>
              <div className="ub-stat"><div className="val" style={{ color:'#4a3634' }}>{fmtCurrency(week.contributionPerHour)}</div><div className="lbl" style={{ color:'#a8938e' }}>R$/h</div></div>
            </div>
            <div style={{ fontSize:13, color:'#6b5450', marginTop:14, lineHeight:1.5 }}>
              {week.sessions.length > 0 ? (() => {
                const best = week.sessions.map(calcSession).sort((a,b) => b.contributionPerHour - a.contributionPerHour)[0];
                return 'Melhor sessao da semana: '+fmtDate(best.date)+', '+fmtCurrency(best.contributionPerHour)+'/h apos combustivel.';
              })() : 'Ainda nao ha sessoes suficientes para analise.'}
            </div>
          </div>
        )}

        {tab === 'settings' && (<>
          <div className="ub-card">
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:10 }}>Meta semanal</div>
            <div style={{ display:'flex', gap:10, marginBottom:10 }}>
              <div style={{ flex:1 }}><label className="ub-label">Quero sobrar na semana</label><input type="number" className="ub-input" value={settings.weeklyNetGoal} onChange={e => setSettings(s => ({...s, weeklyNetGoal:parseNum(e.target.value)}))} /></div>
              <div style={{ flex:1 }}><label className="ub-label">Aluguel semanal</label><input type="number" className="ub-input" value={settings.weeklyRent} onChange={e => setSettings(s => ({...s, weeklyRent:parseNum(e.target.value)}))} /></div>
            </div>
            <div>
              <label className="ub-label">Custos extras na semana (R$)</label>
              <input type="number" step="0.01" className="ub-input" value={settings.weeklyExtraCosts} onChange={e => setSettings(s => ({...s, weeklyExtraCosts:parseNum(e.target.value)}))} />
              <div className="ub-tip">Seguro, parcela do carro, manutencao, etc. Descontado junto com o aluguel.</div>
            </div>
          </div>
          <div className="ub-card">
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:10 }}>Etanol e media</div>
            <div style={{ display:'flex', gap:10, marginBottom:10 }}>
              <div style={{ flex:1 }}><label className="ub-label">Etanol (R$/L)</label><input type="number" step="0.01" className="ub-input" value={settings.fuelPricePerLiter} onChange={e => setSettings(s => ({...s, fuelPricePerLiter:parseNum(e.target.value)}))} /></div>
              <div style={{ flex:1 }}><label className="ub-label">Consumo (km/L)</label><input type="number" step="0.1" className="ub-input" value={settings.consumptionKmPerLiter} onChange={e => setSettings(s => ({...s, consumptionKmPerLiter:parseNum(e.target.value)}))} /></div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}><label className="ub-label">Bruto medio/hora</label><input type="number" step="0.01" className="ub-input" value={settings.averageGrossPerHour} onChange={e => setSettings(s => ({...s, averageGrossPerHour:parseNum(e.target.value)}))} /></div>
              <div style={{ flex:1 }}><label className="ub-label">Bruto medio/km pago</label><input type="number" step="0.01" className="ub-input" value={settings.averageGrossPerPaidKm} onChange={e => setSettings(s => ({...s, averageGrossPerPaidKm:parseNum(e.target.value)}))} /></div>
            </div>
          </div>
          <div className="ub-card">
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:10 }}>Descanso e limite</div>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}><label className="ub-label">Sono minimo (h)</label><input type="number" step="0.5" className="ub-input" value={settings.restRules.minimumSleepHours} onChange={e => setSettings(s => ({...s, restRules:{...s.restRules, minimumSleepHours:parseNum(e.target.value)}}))} /></div>
              <div style={{ flex:1 }}><label className="ub-label">Pausa pos-CLT (h)</label><input type="number" step="0.5" className="ub-input" value={settings.restRules.postCltBufferHours} onChange={e => setSettings(s => ({...s, restRules:{...s.restRules, postCltBufferHours:parseNum(e.target.value)}}))} /></div>
              <div style={{ flex:1 }}><label className="ub-label">Max. Uber/dia (h)</label><input type="number" step="0.5" className="ub-input" value={settings.restRules.maximumUberHoursPerDay} onChange={e => setSettings(s => ({...s, restRules:{...s.restRules, maximumUberHoursPerDay:parseNum(e.target.value)}}))} /></div>
            </div>
          </div>
          <div className="ub-card">
            <div style={{ fontSize:12.5, fontWeight:800, color:'#8a6f6a', textTransform:'uppercase', marginBottom:10 }}>Importar dados</div>
            <div className="ub-tip" style={{ marginBottom:10 }}>Importa configuracoes, sessoes e excecoes do app Jornada do Casal original.</div>
            <button className="ub-btn-outline" onClick={() => {
              if (!confirm('Importar dados do Jornada do Casal? Sessoes atuais serao substituidas.')) return;
              try {
                const raw = localStorage.getItem('jornada_casal_data_v2');
                if (!raw) { alert('Nenhum dado encontrado no Jornada do Casal.'); return; }
                const data = JSON.parse(raw);
                const uber = data.uberRoutine;
                if (!uber) { alert('Dados do Uber nao encontrados no Jornada do Casal.'); return; }
                if (uber.settings) {
                  setSettings(prev => ({
                    ...prev,
                    weeklyNetGoal: uber.settings.weeklyNetGoal || prev.weeklyNetGoal,
                    weeklyRent: uber.settings.weeklyRent || prev.weeklyRent,
                    weeklyExtraCosts: uber.settings.weeklyExtraCosts || prev.weeklyExtraCosts,
                    fuelPricePerLiter: uber.settings.fuelPricePerLiter || prev.fuelPricePerLiter,
                    consumptionKmPerLiter: uber.settings.consumptionKmPerLiter || prev.consumptionKmPerLiter,
                    averageGrossPerHour: uber.settings.averageGrossPerHour || prev.averageGrossPerHour,
                    averageGrossPerPaidKm: uber.settings.averageGrossPerPaidKm || prev.averageGrossPerPaidKm,
                    restRules: { ...prev.restRules, ...(uber.settings.restRules || {}) },
                    cltSchedule: { ...prev.cltSchedule, ...(uber.settings.cltSchedule || {}) }
                  }));
                }
                if (uber.sessions) setSessions(uber.sessions);
                if (uber.scheduleOverrides) setOverrides(uber.scheduleOverrides);
                alert('Dados importados com sucesso!');
              } catch(e) { alert('Erro ao importar: ' + e.message); }
            }}>Importar do Jornada do Casal</button>
          </div>
        </>)}
      </div>

      {sheet && sheet.type==='session' && (
        <Sheet title={sheet.editId?'Editar sessao':'Nova sessao'} actionLabel="Salvar sessao" onClose={() => setSheet(null)} onAction={() => {
          const date=document.getElementById('ub-s-date').value;
          const startedAt=document.getElementById('ub-s-start').value;
          const endedAt=document.getElementById('ub-s-end').value;
          const grossRevenue=parseNum(document.getElementById('ub-s-gross').value);
          const distanceKm=parseNum(document.getElementById('ub-s-km').value);
          const fuelPricePerLiter=parseNum(document.getElementById('ub-s-fuel').value)||settings.fuelPricePerLiter;
          const consumptionKmPerLiter=parseNum(document.getElementById('ub-s-cons').value)||settings.consumptionKmPerLiter;
          const notes=(document.getElementById('ub-s-notes').value||'').trim();
          if(!date||!startedAt||!endedAt||!grossRevenue||!distanceKm){alert('Preencha todos os campos obrigatorios');return;}
          const id=sheet.editId||(date+'_'+Date.now());
          addSession({id,date,startedAt,endedAt,grossRevenue,distanceKm,fuelPricePerLiter,consumptionKmPerLiter,notes,createdAt:new Date().toISOString()});
          setSheet(null);
        }}>
          <label className="ub-label">Data</label><input type="date" id="ub-s-date" className="ub-input" defaultValue={sheet.date} />
          <div style={{ display:'flex', gap:10, marginTop:10 }}>
            <div style={{ flex:1 }}><label className="ub-label">Inicio</label><input type="time" id="ub-s-start" className="ub-input" defaultValue={sheet.startAt} /></div>
            <div style={{ flex:1 }}><label className="ub-label">Fim</label><input type="time" id="ub-s-end" className="ub-input" defaultValue={sheet.endAt} /></div>
          </div>
          <label className="ub-label" style={{ marginTop:10 }}>Bruto recebido (R$)</label><input type="number" id="ub-s-gross" className="ub-input" step="0.01" placeholder="Ex: 80,00" />
          <div style={{ display:'flex', gap:10, marginTop:10 }}>
            <div style={{ flex:1 }}><label className="ub-label">Km rodado</label><input type="number" id="ub-s-km" className="ub-input" step="0.1" placeholder="Ex: 83" defaultValue={sheet.liveKm||''} /></div>
            <div style={{ flex:1 }}><label className="ub-label">Etanol (R$/L)</label><input type="number" id="ub-s-fuel" className="ub-input" step="0.01" defaultValue={settings.fuelPricePerLiter} /></div>
          </div>
          {sheet.liveKm ? <div className="ub-tip">KM preenchido automaticamente pelo GPS do cronometro.</div> : null}
          <div style={{ marginTop:10 }}><label className="ub-label">Consumo nessa sessao (km/L)</label><input type="number" id="ub-s-cons" className="ub-input" step="0.1" defaultValue={settings.consumptionKmPerLiter} /><div className="ub-tip">Cada sessao pode ter etanol e consumo proprios.</div></div>
          <textarea id="ub-s-notes" className="ub-input" placeholder="Observacao opcional" rows="2" style={{ resize:'none', marginTop:10 }} defaultValue={sheet.notes} />
        </Sheet>
      )}

      {sheet && sheet.type==='schedule' && (
        <Sheet title="Escala CLT" actionLabel="Salvar escala" onClose={() => setSheet(null)} onAction={() => {
          const patternType=document.getElementById('ub-pat').value;
          const anchorDate=document.getElementById('ub-anch').value;
          const shiftStart=document.getElementById('ub-ss').value||'18:00';
          const shiftEnd=document.getElementById('ub-se').value||'05:00';
          setSettings({...settings, cltSchedule:{...settings.cltSchedule, patternType, anchorDate, shiftStart, shiftEnd}});
          setSheet(null);
        }}>
          <label className="ub-label">Padrao</label>
          <select id="ub-pat" className="ub-input">
            <option value="2x2_3x3" selected={settings.cltSchedule.patternType!=='3x2'}>2x2 + 3x3</option>
            <option value="3x2" selected={settings.cltSchedule.patternType==='3x2'}>3x2</option>
          </select>
          <div className="ub-tip">No 2x2 + 3x3, a data abaixo deve ser o primeiro dia de trabalho da sequencia.</div>
          <label className="ub-label" style={{ marginTop:10 }}>Data conhecida (1 dia de trabalho do ciclo)</label>
          <input type="date" id="ub-anch" className="ub-input" defaultValue={settings.cltSchedule.anchorDate} />
          <label className="ub-label" style={{ marginTop:10 }}>Horario do turno CLT</label>
          <div style={{ display:'flex', gap:10 }}>
            <input type="time" id="ub-ss" className="ub-input" defaultValue={settings.cltSchedule.shiftStart} />
            <input type="time" id="ub-se" className="ub-input" defaultValue={settings.cltSchedule.shiftEnd} />
          </div>
        </Sheet>
      )}

      {sheet && sheet.type==='override' && (
        <Sheet title="Excecao de escala" actionLabel="Adicionar excecao" onClose={() => setSheet(null)} onAction={() => {
          const date=document.getElementById('ub-ov-date').value;
          const overrideType=document.getElementById('ub-ov-type').value;
          const reason=(document.getElementById('ub-ov-reason').value||'').trim();
          if(!date){alert('Informe a data');return;}
          addOverride({date,overrideType,reason});
          setSheet(null);
        }}>
          <label className="ub-label">Data</label><input type="date" id="ub-ov-date" className="ub-input" defaultValue={getTodayStr()} />
          <label className="ub-label" style={{ marginTop:10 }}>Tipo</label>
          <select id="ub-ov-type" className="ub-input">
            <option value="off">Folga nessa data</option>
            <option value="work">Trabalho nessa data</option>
          </select>
          <label className="ub-label" style={{ marginTop:10 }}>Motivo</label><input type="text" id="ub-ov-reason" className="ub-input" placeholder="Ex: troca de escala" />
        </Sheet>
      )}

      {sheet && sheet.type==='detail' && (
        <Sheet title={'Sessao de '+fmtDate(sheet.session.date)} actionLabel="Fechar" onClose={() => setSheet(null)} onAction={() => setSheet(null)}>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Horario</span><span style={{ fontSize:13, color:'#4a3634' }}>{sheet.session.startedAt} - {sheet.session.endedAt} ({sheet.session.durationHours.toFixed(1)}h)</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Distancia</span><span style={{ fontSize:13, color:'#4a3634' }}>{sheet.session.totalKm.toFixed(0)} km</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Bruto</span><span style={{ fontSize:13, color:'#4a3634' }}>{fmtCurrency(sheet.session.grossRevenue)}</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Etanol</span><span style={{ fontSize:13, color:'#4a3634' }}>{fmtCurrency(sheet.session.fuelCost)}</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Preco etanol</span><span style={{ fontSize:13, color:'#4a3634' }}>{fmtCurrency(sheet.session.fuelPricePerLiter)}/L</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Consumo</span><span style={{ fontSize:13, color:'#4a3634' }}>{Number(sheet.session.consumptionKmPerLiter||0).toFixed(1)} km/L</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Liquido</span><span style={{ fontSize:14, fontWeight:800, color:'#7fb88f' }}>{fmtCurrency(sheet.session.contribution)}</span></div>
          <div className="ub-row-between"><span style={{ fontSize:12, color:'#a8938e' }}>Liquido/h</span><span style={{ fontSize:13, color:'#4a3634' }}>{fmtCurrency(sheet.session.contributionPerHour)}/h</span></div>
          {sheet.session.notes && <div className="ub-tip">{escHtml(sheet.session.notes)}</div>}
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button className="ub-btn-outline" style={{ flex:1 }} onClick={() => { setSheet({type:'session',startAt:sheet.session.startedAt,endAt:sheet.session.endedAt,date:sheet.session.date,notes:sheet.session.notes||'',editId:sheet.session.id}); }}>Editar</button>
            <button className="ub-btn-danger" style={{ flex:1 }} onClick={() => { removeSession(sheet.session.id); setSheet(null); }}>Excluir</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<UberRoutine />);
