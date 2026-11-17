'use strict';
/* 별지기 · STARWATCH — 게임 진행 */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const panel = $('#panel'), screenEl = $('#screen'), hud = $('#hud'), toolbar = $('#toolbar'), dirpad = $('#dirpad');
let toastT = 0;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 1700); }
const rpick = a => a[Math.floor(Math.random() * a.length)];

/* ───────── 소리 ───────── */
const AU = { ctx: null, on: true };
function au() { if (!AU.ctx) { try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); return AU.ctx; }
function tone(f, d, type, v, when) {
  const a = AU.on && au(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (when || 0);
  o.type = type || 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v || 0.12, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.05);
}
function noise(d, v, lp, when) {
  const a = AU.on && au(); if (!a) return;
  const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1000;
  s.buffer = buf; g.gain.value = v || 0.3; s.connect(f); f.connect(g); g.connect(a.destination); s.start(a.currentTime + (when || 0));
}
const SFX = {
  ok() { [392, 440, 523.25, 587.33, 783.99].forEach((f, i) => tone(f, 0.4, 'triangle', 0.12, i * 0.07)); },
  half() { tone(440, 0.25, 'triangle', 0.11); tone(392, 0.32, 'triangle', 0.11, 0.13); },
  bad() { noise(0.16, 0.6, 1400); tone(85, 0.4, 'sawtooth', 0.16, 0.02); },
  gong() { [98, 147.5, 196.4, 294.8].forEach(f => tone(f, 2.4, 'sine', 0.11)); noise(0.06, 0.25, 600); },
  tick() { tone(990, 0.04, 'square', 0.025); },
  stamp() { noise(0.09, 0.6, 500); tone(70, 0.16, 'sine', 0.3); },
  drum() { tone(62, 0.45, 'sine', 0.5); noise(0.1, 0.35, 320); },
  rank() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.55, 'triangle', 0.12, i * 0.12)); },
  star() { tone(1568, 0.5, 'sine', 0.07); tone(2093, 0.7, 'sine', 0.05, 0.09); },
  pop() { tone(660, 0.08, 'triangle', 0.08); }
};

/* ───────── 트윈 ───────── */
const TW = [];
function tween(o, k, to, ms, done) { for (let i = TW.length - 1; i >= 0; i--) if (TW[i].o === o && TW[i].k === k) TW.splice(i, 1); TW.push({ o, k, from: o[k], to, t0: performance.now(), ms, done }); }
function tweenAz(to, ms) { tween(sky, 'az', sky.az + angDiff(to, sky.az), ms || 700); }
function stepTweens(now) { for (let i = TW.length - 1; i >= 0; i--) { const w = TW[i], u = clamp((now - w.t0) / w.ms, 0, 1), e = u * u * (3 - 2 * u); w.o[w.k] = lerp(w.from, w.to, e); if (u >= 1) { TW.splice(i, 1); if (w.done) w.done(); } } }
function killTweens(o, k) { for (let i = TW.length - 1; i >= 0; i--) if (!o || (TW[i].o === o && (!k || TW[i].k === k))) TW.splice(i, 1); }

/* ───────── 저장 ───────── */
const SAVE = { dex: {}, best: 0 };
try { const s = JSON.parse(localStorage.getItem('starwatch1') || '{}'); if (s && typeof s === 'object') { SAVE.dex = s.dex || {}; SAVE.best = s.best | 0; } } catch (e) { }
function save() { try { localStorage.setItem('starwatch1', JSON.stringify(SAVE)); } catch (e) { } }
function dexAdd(id) { if (!SAVE.dex[id]) { SAVE.dex[id] = 1; save(); return true; } return false; }

/* ───────── 게임 상태 ───────── */
const RANKS = [['생도', 0], ['참봉', 300], ['직장', 700], ['주부', 1200], ['판관', 1700], ['첨정', 2300], ['관상감 정', 3000]];
const G = { mode: 'title', list: [], idx: 0, score: 0, combo: 0, strikes: 0, timer: 0, tmax: 0, live: false, cur: null, okN: 0, missN: 0, total: 0, multi: false, fbOpen: false, onTap: null, onTimeout: null, dirpad: false, toolOK: false, rank: 0, act: '', play: false };
const rankOf = s => { let r = 0; RANKS.forEach((x, i) => { if (s >= x[1]) r = i; }); return r; };

function setScene(s) {
  scene = s;
  const b = $('#bScene'); b.textContent = s === 'sky' ? '🌐 혼천의' : '🔭 하늘'; b.classList.toggle('on', s === 'space');
  b.classList.toggle('hide', !G.toolOK);
  toolbar.classList.toggle('hide', !(s === 'space' && SP.free));
  dirpad.classList.toggle('hide', !(s === 'sky' && G.dirpad));
}
function resetStage() {
  killTweens();
  Object.assign(sky, { cloud: 0, hi: null, labels: false, ghost: null, moonLabel: '', hunt: false, ecl: null, lock: false, wide: 0, hideMoon: false, alt: ALT0 });
  G.onTap = null; G.onTimeout = null; G.dirpad = false; G.toolOK = false; G.keepSpace = false; T = tool;
  spCfg({ free: true, dragE: true, dragM: true, dragO: true });
  setScene('sky');
}
function setSky(m) { sky.doy = m.doy; sky.hour = m.hour; sky.L = m.L || 10; }
function setPanel(o) {
  panel.classList.remove('hide'); panel.innerHTML = ''; panel.scrollTop = 0;
  const row = el('div', 'row'), col = el('div'); col.style.flex = '1'; col.style.minWidth = '0';
  row.append(el('div', 'ava', o.ava || '📜'));
  if (o.who) col.append(el('div', 'who', o.who));
  if (o.text) col.append(el('div', 'say', o.text));
  if (o.hint) col.append(el('div', 'hint', o.hint));
  row.append(col); if (o.side) row.append(o.side); panel.append(row);
  if (o.body) { const b = el('div', 'body'); b.append(o.body); panel.append(b); }
}
function updateHUD() {
  $('#hRank').textContent = G.multi ? '과거' : RANKS[G.rank][0];
  $('#hScore').textContent = G.score;
  $('#hCombo').textContent = G.combo > 1 ? '연속 ' + G.combo : '';
  $('#hLife').textContent = G.multi || G.mode !== 'story' ? '' : '🪵'.repeat(G.strikes) + '▫'.repeat(Math.max(0, 3 - G.strikes));
  let n = 0; for (let i = 0; i <= G.idx && i < G.list.length; i++) if (G.list[i].type !== 'ACT') n++;
  const rk = G.multi && window.boardRank ? boardRank() : '';
  $('#hProg').textContent = G.mode === 'sandbox' ? '천문대 — 자유 관측' : (G.multi ? '과거 시험' : G.act) + ' · 임무 ' + Math.max(1, n) + '/' + G.total + (rk ? ' · ' + rk : '');
}
function punish() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 500); }

/* ───────── 문제 은행 (상소·밀서 감정) ───────── */
const QBANK = [
  { s: '달은 스스로 빛을 내지 못하고, 햇빛을 반사하여 밝게 보이옵니다.', t: 1, why: '달은 햇빛을 받는 쪽 절반만 밝다. 그 밝은 면이 지구에서 얼마나 보이느냐에 따라 모양이 달라진다.' },
  { s: '달의 모양이 날마다 변하는 까닭은, 지구의 그림자가 달을 조금씩 가리기 때문이옵니다.', t: 0, why: '달의 위상은 태양·지구·달의 위치 관계가 변해, 달의 밝은 면이 보이는 정도가 달라져서 생긴다. 지구 그림자에 가려지는 것은 월식이다.' },
  { s: '달이 태양과 같은 방향에 있을 때를 삭이라 하며, 이때는 달을 볼 수 없사옵니다.', t: 1, why: '삭(음력 1일쯤)에는 달의 어두운 면이 지구를 향하고, 태양과 함께 뜨고 진다.' },
  { s: '상현달은 오른쪽 절반이, 하현달은 왼쪽 절반이 밝게 보이옵니다.', t: 1, why: '우리나라(북반구)에서 남쪽 하늘을 볼 때 상현달은 오른쪽, 하현달은 왼쪽이 밝다.' },
  { s: '초승달은 새벽녘 동쪽 하늘에서 볼 수 있사옵니다.', t: 0, why: '초승달은 초저녁 서쪽 하늘에서 보인다. 새벽 동쪽 하늘에 보이는 것은 그믐달이다.' },
  { s: '보름달은 해 질 무렵 동쪽에서 떠서, 자정 무렵 남쪽 하늘에 높이 뜨옵니다.', t: 1, why: '보름달은 태양의 정반대편에 있어 해가 질 때 뜨고 해가 뜰 때 진다.' },
  { s: '달이 뜨는 시각은 날마다 약 50분씩 늦어지옵니다.', t: 1, why: '달이 지구 둘레를 하루에 약 13°씩 서→동으로 공전하기 때문이다.' },
  { s: '매일 같은 시각에 달을 보면, 달의 위치는 날마다 동쪽에서 서쪽으로 옮겨 가옵니다.', t: 0, why: '반대다. 달은 서→동으로 공전하므로, 같은 시각에 보면 하루에 약 13°씩 서쪽에서 동쪽으로 옮겨 간다.' },
  { s: '달의 모양이 삭에서 다음 삭으로 돌아오는 데에는 약 한 달(29.5일)이 걸리옵니다.', t: 1, why: '삭 → 초승달 → 상현달 → 보름달 → 하현달 → 그믐달 → 삭. 음력 한 달의 길이다.' },
  { s: '하현달은 초저녁에 남쪽 하늘에서 볼 수 있사옵니다.', t: 0, why: '초저녁 남쪽 하늘의 반달은 상현달이다. 하현달은 자정쯤 떠서 새벽에 남쪽 하늘에 있다.' },
  { s: '음력 7~8일 무렵에는 상현달이, 음력 22~23일 무렵에는 하현달이 뜨옵니다.', t: 1, why: '음력 1일쯤 삭, 7~8일 상현, 15일쯤 망(보름), 22~23일 하현.' },
  { s: '일식은 달이 태양을 가리는 현상으로, 태양–달–지구 순서로 나란할 때 일어나옵니다.', t: 1, why: '달이 태양과 지구 사이에 오는 삭일 때, 달이 태양을 가린다.' },
  { s: '일식은 보름달이 뜨는 날에 일어나옵니다.', t: 0, why: '일식은 삭(음력 1일쯤)에 일어난다. 보름(망)에 일어날 수 있는 것은 월식이다.' },
  { s: '월식은 달이 지구의 그림자 속으로 들어가 가려지는 현상이며, 보름에 일어나옵니다.', t: 1, why: '태양–지구–달 순서로 나란한 망일 때, 달이 지구의 본그림자에 들어간다.' },
  { s: '개기 일식은 그때 낮인 지역이라면 어디에서나 볼 수 있사옵니다.', t: 0, why: '달의 본그림자가 닿는 좁은 지역에서만 개기 일식을 볼 수 있다. 반그림자가 닿는 곳에서는 부분 일식이 보인다.' },
  { s: '월식은 그때 밤인 지역이라면 어디에서나 볼 수 있사옵니다.', t: 1, why: '달 자체가 지구 그림자에 가려지는 것이므로, 달이 보이는(밤인) 모든 곳에서 볼 수 있다.' },
  { s: '일식이 일어날 때 태양은 오른쪽(서쪽)부터 가려지옵니다.', t: 1, why: '달이 서→동으로 공전하면서 태양 앞을 지나가므로, 태양의 오른쪽(서쪽)부터 가려진다.' },
  { s: '월식이 일어날 때 달은 오른쪽(서쪽)부터 가려지옵니다.', t: 0, why: '달이 서→동으로 움직여 지구 그림자 속으로 들어가므로, 달의 왼쪽(동쪽)부터 가려진다.' },
  { s: '일식과 월식은 매달 한 번씩 반드시 일어나옵니다.', t: 0, why: '달의 공전 궤도가 지구의 공전 궤도에 대해 약 5° 기울어져 있어, 삭이나 망이라도 대개는 일직선에서 벗어난다.' },
  { s: '달의 반그림자가 닿는 지역에서는 태양의 일부만 가려지는 부분 일식을 볼 수 있사옵니다.', t: 1, why: '본그림자 → 개기 일식, 반그림자 → 부분 일식.' },
  { s: '개기 월식 때 달은 완전히 사라지지 않고 붉게 보이옵니다.', t: 1, why: '지구 대기를 지나며 꺾인 붉은빛이 달에 닿기 때문이다.' },
  { s: '별자리가 계절에 따라 달라지는 까닭은 지구가 태양 둘레를 공전하기 때문이옵니다.', t: 1, why: '지구가 공전하면서 한밤중에 향하는 방향(태양 반대쪽)이 달라지므로 보이는 별자리가 바뀐다.' },
  { s: '별들이 하루에 한 바퀴씩 도는 것처럼 보이는 까닭은 지구의 공전 때문이옵니다.', t: 0, why: '별의 일주 운동은 지구의 자전(서→동, 하루 한 바퀴) 때문이다. 공전은 계절별 별자리 변화의 원인이다.' },
  { s: '태양이 별자리 사이를 지나가는 길을 황도라 하고, 그 길에 놓인 열두 별자리를 황도 12궁이라 하옵니다.', t: 1, why: '지구가 공전하므로 태양은 별자리 사이를 서→동으로 이동하여 1년 뒤 제자리로 돌아오는 것처럼 보인다.' },
  { s: '태양이 지나고 있는 별자리는 그 무렵 한밤중 남쪽 하늘에서 가장 잘 보이옵니다.', t: 0, why: '태양과 같은 방향에 있어 태양과 함께 뜨고 지므로 볼 수 없다. 한밤중 남쪽 하늘에는 태양 반대편 별자리가 보인다.' },
  { s: '매일 같은 시각에 관측하면, 별자리는 하루에 약 1°씩 동쪽에서 서쪽으로 옮겨 가옵니다.', t: 1, why: '지구가 하루에 약 1°씩 공전하기 때문이다. 한 달이면 약 30°, 1년이면 한 바퀴.' },
  { s: '태양은 별자리 사이를 동쪽에서 서쪽으로 이동하여 1년 뒤 제자리로 돌아오옵니다.', t: 0, why: '태양은 별자리 사이를 서→동으로 이동한다(하루 약 1°). 지구의 공전 방향과 같다.' },
  { s: '북쪽 하늘의 별들은 북극성을 중심으로 시계 반대 방향으로 도옵니다.', t: 1, why: '지구가 서→동으로 자전하기 때문이다. 1시간에 15°씩 돈다.' },
  { s: '별은 지구의 자전 때문에 한 시간에 약 30°씩 움직이는 것처럼 보이옵니다.', t: 0, why: '360° ÷ 24시간 = 1시간에 15°.' },
  { s: '오리온자리는 겨울철, 전갈자리는 여름철 밤하늘의 대표 별자리이옵니다.', t: 1, why: '오리온자리와 전갈자리는 하늘에서 거의 정반대편에 있어 같은 밤하늘에서 함께 보기 어렵다.' },
  { s: '한여름 자정에 남쪽 하늘을 보면 오리온자리가 높이 떠 있사옵니다.', t: 0, why: '여름에는 태양이 오리온자리 근처 방향에 있어 오리온자리는 낮에 떠 있다. 여름 자정 남쪽 하늘에는 전갈·궁수자리가 보인다.' },
  { s: '9월 초 태양은 사자자리 부근을 지나므로, 이 무렵 한밤중 남쪽 하늘에는 물병자리가 보이옵니다.', t: 1, why: '사자자리의 정반대편(6개월 차이)이 물병자리다.' },
  { s: '3월 초 한밤중에는 남쪽 하늘에서 물병자리가 가장 잘 보이옵니다.', t: 0, why: '3월 초에는 태양이 물병자리를 지나므로 볼 수 없다. 반대편의 사자자리가 한밤중 남쪽 하늘에 뜬다.' },
  { s: '북극성은 밤새 거의 움직이지 않아 북쪽을 찾는 길잡이가 되옵니다.', t: 1, why: '북극성은 지구 자전축을 늘인 방향 가까이에 있다. 북두칠성이나 카시오페이아자리로 찾을 수 있다.' }
];
const FROMS = ['저잣거리 점쟁이의 상소', '지방 관아의 천문 보고', '수상한 밀서', '신참 생도의 관측 일지', '떠돌이 술사의 예언서'];

/* ───────── 임무 생성 (모두 시드 난수로 결정) ───────── */
const SEASONS = { 봄: [3, 4, 5], 여름: [6, 7, 8], 가을: [9, 10, 11], 겨울: [12, 1, 2] }, ANY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MOON_HOURS = { 3: [18, 19, 20, 0], 8: [18, 19, 21, 0, 3], 15: [19, 21, 0, 3, 5], 22: [21, 0, 1, 3, 5], 27: [21, 4, 5, 6] };
const randDoy = (r, mo) => { const m = r.pick(mo); return doyOf(m, r.int(1, MDAYS[m - 1])); };
const GEN = {
  A(r, mo) {
    for (let i = 0; i < 300; i++) {
      const doy = randDoy(r, mo), hour = r.pick([21, 22, 23, 0, 1, 2]); if (sunAltAz(doy, hour).alt > -12) continue;
      const c = CONS.filter(c => { const v = conView(c, doy, hour); return v.alt > 20 && v.minAlt > 8; }); if (!c.length) continue;
      return { type: 'A', doy, hour, L: r.pick([3, 8, 12, 18, 22, 27]), con: r.pick(c).id, time: 50 };
    }
    return { type: 'A', doy: 15, hour: 22, L: 8, con: 'ori', time: 50 };
  },
  B(r, mo) {
    for (let i = 0; i < 400; i++) {
      const doy = randDoy(r, mo), hour = r.pick([21, 0, 3]), zone = r.pick(['동', '남', '서']), zc = ZONE_AZ[zone]; if (sunAltAz(doy, hour).alt > -10) continue;
      const vs = CONS.map(c => ({ c, v: conView(c, doy, hour) }));
      const inz = vs.filter(o => Math.abs(angDiff(o.v.az, zc)) <= 28 && o.v.alt >= 15 && o.v.alt <= (zone === '남' ? 80 : 66) && o.v.minAlt > 4); if (!inz.length) continue;
      const ans = r.pick(inz).c;
      const inv = r.shuffle(vs.filter(o => o.v.alt < -8 && o.v.maxAlt < 4).map(o => o.c.id)), els = r.shuffle(vs.filter(o => o.v.alt > 12 && Math.abs(angDiff(o.v.az, zc)) >= 80).map(o => o.c.id));
      const ds = inv.slice(0, 2).concat(els.slice(0, 1)), pool = inv.slice(2).concat(els.slice(1));
      while (ds.length < 3 && pool.length) ds.push(pool.shift());
      if (ds.length < 3) continue;
      return { type: 'B', doy, hour, L: r.pick([3, 8, 22, 27]), zone, con: ans.id, opts: r.shuffle([ans.id].concat(ds)), time: 60 };
    }
    return { type: 'B', doy: 15, hour: 21, L: 3, zone: '남', con: 'ori', opts: ['sco', 'ori', 'lyr', 'uma'], time: 60 };
  },
  C(r, mo) {
    const pool = CONS.filter(c => Math.abs(c.dec) < 33);
    for (let i = 0; i < 400; i++) {
      const c = r.pick(pool), th = r.pick([20, 22, 0, 2, 4]), ra = mod(c.ra - (th - 12) * 15, 360);
      const doy = lonToDoy(Math.atan2(Math.sin(ra * RAD), Math.cos(ra * RAD) * Math.cos(EPS)) / RAD);
      if (!mo.includes(mdOf(doy).m) || sunAltAz(doy, th).alt > -9) continue;
      return { type: 'C', doy, hour: th, L: r.pick([3, 27]), con: c.id, ans: th, time: 60 };
    }
    return { type: 'C', doy: 348, hour: 0, L: 3, con: 'ori', ans: 0, time: 60 };
  },
  E(r, mo, ctx, noNone) {
    for (let i = 0; i < 500; i++) {
      const doy = randDoy(r, mo), L = r.pick([3, 8, 15, 22, 27]), hour = r.pick(MOON_HOURS[L]); if (sunAltAz(doy, hour).alt > -5) continue;
      const z = moonZone(doy, hour, L); if (!z) continue; if (z === 'none' && (noNone || !r.chance(0.2))) continue;
      return { type: 'E', doy, hour, L, zone: z, time: 60 };
    }
    return { type: 'E', doy: 80, hour: 0, L: 15, zone: '남', time: 60 };
  },
  D(r, mo, ctx) {
    const from = r.int(0, FROMS.length - 1);
    if (r.chance(0.55)) { let k, n = 0; do { k = r.int(0, QBANK.length - 1); } while (ctx.usedQ.has(k) && ++n < 60); ctx.usedQ.add(k); return { type: 'D', kind: 'q', q: k, from, time: 40 }; }
    if (r.chance(0.5)) {
      const b = GEN.B(r, mo); let truth = r.chance(0.5), con = b.con;
      if (!truth) { const f = b.opts.find(id => id !== b.con && conView(CON[id], b.doy, b.hour).alt < -8); if (f) con = f; else truth = true; }
      return { type: 'D', kind: 'con', doy: b.doy, hour: b.hour, L: b.L, zone: b.zone, con, real: b.con, truth, from, time: 40 };
    }
    const e = GEN.E(r, mo, ctx, true), v = r.int(0, 3), nm = phaseOf(e.L).name;
    let cz = e.zone, cn = nm;
    if (v === 1) cz = e.zone === '동' ? '서' : e.zone === '서' ? '동' : r.pick(['동', '서']);
    if (v === 2) cn = { 초승달: '그믐달', 그믐달: '초승달', 상현달: '하현달', 하현달: '상현달', 보름달: '초승달' }[nm];
    return { type: 'D', kind: 'moon', doy: e.doy, hour: e.hour, L: e.L, zone: e.zone, cz, cn, truth: v === 0 || v === 3, from, time: 40 };
  },
  G(r) { const k = r.int(0, 11); let st; do { st = r.int(1, 12); } while (st === zodMonth(k)); return { type: 'G', k, start: st, opts: r.shuffle([(k + 6) % 12, k, (k + 3) % 12, (k + 9) % 12]), time: 75 }; },
  F(r, kind, boss) { return { type: 'F', kind, boss: !!boss, start: r.pick([1, 2, 3, 5, 6, 7]), time: boss ? 90 : 75 }; }
};
function buildCampaign(seed) {
  const r = RNG(seed), ctx = { usedQ: new Set() }, L = [], S_ = SEASONS;
  const act = (title, text) => L.push({ type: 'ACT', title, text });
  act('제1장 · 봄밤 — 첫 근무', '관상감에 들어온 첫날 밤. 영감이 붓을 내려놓으며 말한다.\n“하늘을 읽는 일은 목숨을 거는 일이다. 틀리면 곤장, 세 대를 맞으면 파직이니라.”');
  L.push(GEN.A(r, S_.봄), GEN.B(r, S_.봄), GEN.E(r, S_.봄, ctx), GEN.D(r, S_.봄, ctx));
  act('제2장 · 여름밤 — 은하수 아래', '장마가 걷히고 은하수가 남쪽 하늘로 쏟아진다.\n임금께서 밤마다 별을 물으시니, 관상감은 잠들 틈이 없다.');
  L.push(GEN.A(r, S_.여름), GEN.C(r, S_.여름), GEN.G(r), GEN.D(r, S_.여름, ctx));
  act('제3장 · 가을밤 — 붉은 달', '한가위가 가까운 밤, 도성에 흉흉한 소문이 돈다.\n“머지않아 달이 피처럼 붉어진다더라!”');
  L.push(GEN.B(r, S_.가을), GEN.E(r, S_.가을, ctx), GEN.F(r, 'lunar'), GEN.D(r, S_.가을, ctx));
  act('제4장 · 겨울밤 — 오리온이 뜨는 밤', '입김이 얼어붙는 겨울 간의대.\n일 년 중 가장 화려한 밤하늘이 머리 위에 펼쳐진다.');
  L.push(GEN.A(r, S_.겨울), GEN.C(r, S_.겨울), GEN.B(r, S_.겨울), GEN.E(r, S_.겨울, ctx));
  act('종장 · 구식례 — 해를 구하라', '일식이 예보된 날. 임금과 백관이 소복을 입고 뜰에 늘어섰다.\n북을 울려 해를 구하는 의식, 구식례(救食禮). 예보가 한 치라도 어긋나면… 알지?');
  L.push(GEN.F(r, 'solar', true));
  return L;
}
function buildMulti(seed, n) {
  const r = RNG(seed), ctx = { usedQ: new Set() }, order = ['B', 'E', 'D', 'A', 'C', 'G', 'D', 'B', 'E', 'F', 'A', 'D', 'C', 'E', 'G', 'B'], L = [];
  for (let i = 0; i < n - 1; i++) { const t = order[i % order.length]; L.push(t === 'F' ? GEN.F(r, 'lunar') : GEN[t](r, ANY, ctx)); }
  L.push(GEN.F(r, 'solar', true)); return L;
}

/* ───────── 임무 진행 ───────── */
const KING = { ava: '👑', who: '임금' }, ELDER = { ava: '🧓', who: '관상감 영감' };
const TOOLHINT = '막막하면 위의 [🌐 혼천의]를 열어, 지구(날짜)와 관측자(시각)·달(음력)을 직접 돌려 보라.';
function conCards(ids, onPick) {
  const wrap = el('div', 'cards');
  ids.forEach(id => { const c = CON[id], b = el('button', 'card'), cvs = document.createElement('canvas'); cvs.width = cvs.height = 120; drawThumb(cvs, c); b.append(cvs, el('span', null, c.full)); b.dataset.id = id; b.onclick = () => onPick(id, wrap); wrap.append(b); });
  return wrap;
}
function markCards(wrap, right, picked) { wrap.querySelectorAll('button').forEach(b => { b.disabled = true; const id = b.dataset.id; if (id === String(right)) b.classList.add('ok'); else if (id === String(picked)) b.classList.add('no'); }); }
function optRow(items, onPick) {       // items: [{v, label, small, moonL}]
  const wrap = el('div', 'opts');
  items.forEach(it => { const b = el('button', 'opt'); if (it.moonL) { const c = document.createElement('canvas'); c.width = c.height = 92; drawMoonIcon(c, it.moonL); b.append(c); } b.append(el('span', null, it.label)); if (it.small) b.append(el('small', null, it.small)); b.dataset.id = it.v; b.onclick = () => { SFX.pop(); onPick(it.v, wrap, b); }; wrap.append(b); });
  return wrap;
}
function selOpt(wrap, b) { wrap.querySelectorAll('button').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); }
function revealSky(o) {                 // 구름을 걷고 실제 하늘을 보여 준다
  setScene('sky'); tween(sky, 'cloud', 0, 1300); sky.labels = o.labels !== false; sky.hi = o.hi || null; sky.ghost = null;
  if (o.az != null) tweenAz(o.az, 900); if (o.alt != null) tween(sky, 'alt', o.alt, 900);
}

const MT = {
  ACT(m) {
    G.act = m.title.split(' — ')[0]; SFX.gong(); G.tmax = 0;
    sky.doy = { 제1장: 100, 제2장: 200, 제3장: 285, 제4장: 10, 종장: 80 }[m.title.slice(0, 3)] || 80; sky.hour = 22; sky.L = 12; sky.labels = true; sky.az = 180;
    const b = el('button', 'btn', '임무 시작 ▶'); b.onclick = () => { G.live = false; next(); };
    const r = el('div', 'right'); r.append(b);
    setPanel({ ava: '🏮', who: m.title, text: m.text, body: r });
  },
  /* A. 망원경 조준 — 별자리 찾기 */
  A(m) {
    const c = CON[m.con]; setSky(m); sky.hunt = true; G.dirpad = true;
    const v = conView(c, m.doy, m.hour); sky.az = mod(Math.round((v.az + 150) / 90) * 90, 360);
    const tg = document.createElement('canvas'); tg.width = tg.height = 180; tg.className = 'tg'; tg.style.width = tg.style.height = '86px'; drawThumb(tg, c);
    let miss = 0;
    const lines = () => { const w = conView(c, m.doy, m.hour); return [c.full + ' — 대표 계절: ' + c.season + '. ' + c.note, dateStr(m.doy) + ' ' + hourStr(m.hour) + '에는 ' + dir8(w.az) + '쪽 하늘, 고도 약 ' + Math.round(w.alt) + '°에 떠 있다.']; };
    const show = () => { sky.hi = c.id; sky.labels = true; const w = conView(c, m.doy, m.hour); tweenAz(w.az, 900); tween(sky, 'alt', clamp(w.alt - 12, ALT0, 58), 900); };
    setPanel(Object.assign({}, KING, { text: '“과인이 ' + c.ko + '를 보고 싶구나.”\n' + dateStr(m.doy) + ' ' + hourStr(m.hour) + '의 밤하늘에서 ' + c.full + '를 찾아 눌러라!', hint: '하늘을 끌거나 방위 버튼으로 돌려 본다. 이름표는 없다 — 그림과 같은 모양을 찾아라. (기회 2번)', side: tg }));
    G.onTap = (x, y) => {
      let best = null, bd = 48;
      for (const k of CONS) { if (!k._p) continue; for (const p of k._p) { if (!p || p.alt < 1) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = k; } } }
      if (!best) return;
      if (best.id === m.con) { dexAdd(c.id); finish(miss ? 0.5 : 1, lines(), show); }
      else if (++miss >= 2) finish(0, ['방금 누른 것은 ' + best.full + '.'].concat(lines()), show);
      else { SFX.half(); toast('그건 ' + best.full + '! 한 번 더.'); }
    };
    G.onTimeout = () => finish(0, ['시간 초과!'].concat(lines()), show);
    $('#bScene').classList.add('hide');
  },
  /* B. 구름 낀 밤 — 어느 별자리가 떠 있나 */
  B(m) {
    const c = CON[m.con]; setSky(m); sky.cloud = 1; sky.az = ZONE_AZ[m.zone]; G.toolOK = true;
    const done = id => {
      const ok = id === m.con, lines = [dateStr(m.doy) + ' ' + hourStr(m.hour) + ', ' + m.zone + '쪽 하늘에는 ' + c.full + '가 떠 있다. (' + c.season + ' 별자리)'];
      if (id && !ok) { const p = CON[id], w = conView(p, m.doy, m.hour); lines.push(p.full + '는 이때 ' + (w.alt < 0 ? '지평선 아래에 있어 보이지 않는다.' : dir8(w.az) + '쪽 하늘에 있다.')); }
      if (!id) lines.unshift('시간 초과!');
      lines.push('지구가 공전하므로 같은 시각에 보이는 별자리가 계절마다 달라지고, 자전하므로 하룻밤 사이에도 동→서로 움직인다.');
      if (ok) dexAdd(c.id);
      finish(ok ? 1 : 0, lines, () => revealSky({ az: ZONE_AZ[m.zone], hi: c.id }));
    };
    const cards = conCards(m.opts, (id, wrap) => { markCards(wrap, m.con, id); done(id); });
    setPanel(Object.assign({}, KING, { text: dateStr(m.doy) + ' ' + hourStr(m.hour) + '. 하늘에 구름이 잔뜩 끼었다.\n“지금 구름 너머 ' + m.zone + '쪽 하늘에는 어느 별자리가 떠 있느냐?”', hint: TOOLHINT, body: cards }));
    G.onTimeout = () => { markCards(cards, m.con, null); done(null); };
  },
  /* C. 행차 시각 — 남중 시각 맞히기 */
  C(m) {
    const c = CON[m.con]; setSky(m); sky.cloud = 1; sky.az = 180; G.toolOK = true;
    const done = h => {
      const d = h == null ? 99 : Math.abs(angDiff(h * 15, m.ans * 15)) / 15, frac = d < 0.5 ? 1 : d < 2.5 ? 0.4 : 0;
      const lines = [dateStr(m.doy) + '에 ' + c.full + '는 ' + hourStr(m.ans) + '쯤 정남쪽에 가장 높이 뜬다(남중).', '별은 지구의 자전 때문에 1시간에 15°씩 동→서로 움직인다. 2시간 이르면 아직 동쪽으로 30° 덜 온 곳에, 2시간 늦으면 서쪽으로 30° 넘어간 곳에 있다.'];
      if (h == null) lines.unshift('시간 초과!');
      if (frac >= 1) dexAdd(c.id);
      finish(frac, lines, () => { revealSky({ az: 180, hi: c.id }); sky.hour = m.ans - 5; tween(sky, 'hour', m.ans, 4200); });
    };
    const row = optRow([20, 22, 0, 2, 4].map(h => ({ v: h, label: hourStr(h) })), (v, wrap, b) => { wrap.querySelectorAll('button').forEach(x => { x.disabled = true; if (+x.dataset.id === m.ans) x.classList.add('ok'); }); if (v !== m.ans) b.classList.add('no'); done(v); });
    setPanel(Object.assign({}, KING, { text: dateStr(m.doy) + ' 밤. “' + c.ko + '가 정남쪽 하늘에 가장 높이 뜰 때 간의대에 오르겠노라.”\n몇 시에 모셔야 하는가?', hint: TOOLHINT + ' (남중 = 관측자의 ‘남’ 화살표가 그 별자리를 가리킬 때)', body: row }));
    G.onTimeout = () => done(null);
  },
  /* D. 상소·밀서 감정 — 참/거짓 도장 */
  D(m) {
    G.toolOK = true; let claim, truth, why = [], rev = null;
    if (m.kind === 'q') { const q = QBANK[m.q]; claim = q.s; truth = !!q.t; why = [q.why]; sky.doy = 80 + m.q * 9; sky.hour = 23; sky.L = 8; sky.labels = true; }
    else if (m.kind === 'con') {
      const c = CON[m.con]; setSky(m); sky.cloud = 1; sky.az = ZONE_AZ[m.zone]; truth = m.truth;
      claim = '“' + dateStr(m.doy) + ' ' + hourStr(m.hour) + ', ' + m.zone + '쪽 하늘에서 ' + c.ko + '를 똑똑히 보았사옵니다.”';
      const w = conView(c, m.doy, m.hour);
      why = truth ? ['그 시각 ' + c.full + '는 실제로 ' + m.zone + '쪽 하늘에 떠 있다.'] : [c.full + '는 그 시각 지평선 아래에 있어 볼 수 없다. (대표 계절: ' + c.season + ')', '그때 ' + m.zone + '쪽 하늘에 떠 있는 것은 ' + CON[m.real].full + '.'];
      rev = () => revealSky({ az: ZONE_AZ[m.zone], hi: truth ? c.id : m.real });
    } else {
      setSky(m); sky.cloud = 1; sky.wide = 1; sky.az = 180; sky.lock = true; truth = m.truth; const ph = phaseOf(m.L);
      claim = '“' + dateStr(m.doy) + '(음력 ' + m.L + '일) ' + hourStr(m.hour) + ', ' + m.cn + '이 ' + m.cz + '쪽 하늘에 떠 있었사옵니다.”';
      why = [truth ? '맞는 보고다. 음력 ' + m.L + '일의 달은 ' + ph.name + '이고, 그 시각 ' + m.zone + '쪽 하늘에 있다.' : m.cn !== ph.name ? '음력 ' + m.L + '일의 달은 ' + m.cn + '이 아니라 ' + ph.name + '이다.' : '그 시각 ' + ph.name + '은 ' + m.cz + '쪽이 아니라 ' + m.zone + '쪽 하늘에 있다.', ph.tip];
      rev = () => { revealSky({ az: 180, labels: false }); sky.moonLabel = ph.name; };
    }
    const paper = el('div', 'paper'); paper.append(el('div', 'from', '📜 ' + FROMS[m.from]), el('div', null, claim));
    const seal = el('div', 'seal'); paper.append(seal);
    const st = el('div', 'stamps'), bt = el('button', 'stamp t'), bf = el('button', 'stamp f');
    bt.append(el('i', null, '眞'), el('span', null, '참이오')); bf.append(el('i', null, '僞'), el('span', null, '거짓이오'));
    const done = ans => { bt.disabled = bf.disabled = true; if (ans != null) { seal.textContent = ans ? '眞' : '僞'; seal.classList.add('on'); paper.classList.add('sealed'); SFX.stamp(); } const ok = ans === truth; const body = el('div'); body.append(paper); finishWith(ok ? 1 : 0, [(ans == null ? '시간 초과! ' : '') + '이 글은 ' + (truth ? '참(眞)' : '거짓(僞)') + '이다.'].concat(why), rev, body); };
    bt.onclick = () => done(true); bf.onclick = () => done(false); st.append(bt, bf);
    const body = el('div'); body.append(paper, st);
    setPanel(Object.assign({}, ELDER, { text: '“이런 글이 올라왔다. 참인지 거짓인지 가려 도장을 찍어라.”', hint: m.kind === 'q' ? '' : TOOLHINT, body }));
    G.onTimeout = () => done(null);
  },
  /* E. 달 예보 — 모양과 위치 */
  E(m) {
    setSky(m); sky.cloud = 1; sky.wide = 1; sky.az = 180; sky.lock = true; G.toolOK = true; sky.ghost = { zone: null, L: 0 };
    const ph = phaseOf(m.L); let sL = 0, sZ = null;
    const go = el('button', 'btn', '아뢰기 ▶'); go.disabled = true;
    const upd = () => { sky.ghost = { zone: sZ === 'none' ? null : sZ, L: sL }; go.disabled = !(sZ && (sL || sZ === 'none')); };
    const r1 = optRow(PHASES.map(p => ({ v: p.L, label: p.name, moonL: p.L })), (v, w, b) => { sL = v; selOpt(w, b); upd(); });
    const r2 = optRow([{ v: '동', label: '동쪽 하늘' }, { v: '남', label: '남쪽 하늘' }, { v: '서', label: '서쪽 하늘' }, { v: 'none', label: '하늘에 없음', small: '아직 안 떴거나 이미 짐' }], (v, w, b) => { sZ = v; selOpt(w, b); upd(); });
    const done = t => {
      const zOK = sZ === m.zone, sOK = sL === m.L; let frac = t ? 0 : m.zone === 'none' ? (zOK ? 1 : sOK ? 0.4 : 0) : (zOK ? 0.6 : 0) + (sOK ? 0.4 : 0);
      r1.querySelectorAll('button').forEach(b => { b.disabled = true; if (+b.dataset.id === m.L) b.classList.add('ok'); else if (b.classList.contains('sel')) b.classList.add('no'); });
      r2.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.dataset.id === m.zone) b.classList.add('ok'); else if (b.classList.contains('sel')) b.classList.add('no'); });
      const p = moonAltAz(m.doy, m.hour, m.L);
      const lines = ['음력 ' + m.L + '일의 달은 ' + ph.name + '. ' + hourStr(m.hour) + '에는 ' + (m.zone === 'none' ? '지평선 아래에 있어 보이지 않는다.' : m.zone + '쪽 하늘(고도 약 ' + Math.round(p.alt) + '°)에 떠 있다.'), ph.tip];
      if (t) lines.unshift('시간 초과!');
      finish(frac >= 0.99 ? 1 : frac, lines, () => { revealSky({ az: 180, labels: false }); sky.moonLabel = ph.name; });
    };
    go.onclick = () => done(false);
    const body = el('div'), rr = el('div', 'right'); rr.append(go);
    body.append(el('div', 'lab', '① 달의 모양'), r1, el('div', 'lab', '② 달이 떠 있는 곳'), r2, rr);
    setPanel(Object.assign({}, KING, { text: dateStr(m.doy) + '(음력 ' + m.L + '일) ' + hourStr(m.hour) + '. 구름이 달을 가렸다.\n“지금 달은 어떤 모양으로, 어느 쪽 하늘에 떠 있겠느냐?”', hint: TOOLHINT, body }));
    G.onTimeout = () => done(true);
  },
  /* F. 일식·월식 */
  F(m) {
    const solar = m.kind === 'solar', nm = solar ? '일식' : '월식'; T = tool; tool.doy = 80; tool.hour = 0; tool.L = 1 + m.start * 45 * 14 / 180;
    spCfg({ dragM: true, snapM: true, obs: false, d1: false }); setScene('space');
    const steps = m.boss ? 3 : 2; let got = 0, stepNo = 0;
    const lines = solar ? ['일식: 태양–달–지구 순서로 나란할 때(삭, 음력 1일쯤) 달이 태양을 가린다.', '달은 서→동으로 공전하므로 태양은 오른쪽(서쪽)부터 가려지고, 오른쪽부터 다시 드러난다.', '달의 본그림자가 닿는 좁은 지역에서는 개기 일식, 반그림자가 닿는 지역에서는 부분 일식이 보인다.']
      : ['월식: 태양–지구–달 순서로 나란할 때(망, 음력 15일쯤) 달이 지구의 본그림자 속으로 들어간다.', '달은 서→동으로 움직여 그림자에 들어가므로 달의 왼쪽(동쪽)부터 가려진다. 개기 월식 때 달은 붉게 보인다.', '월식은 밤인 지역 어디서나 보인다. 달의 궤도가 약 5° 기울어 있어 매달 일어나지는 않는다.'];
    const end = t => finish(got / steps >= 0.99 ? 1 : got / steps, (t ? ['시간 초과!'] : []).concat(lines), () => { setScene('sky'); sky.doy = 80; sky.hour = solar ? 12 : 0; sky.L = solar ? 1 : 15; sky.az = 180; sky.ecl = { kind: m.kind, t0: performance.now() }; if (m.boss) { SFX.drum(); setTimeout(SFX.drum, 500); setTimeout(SFX.drum, 1000); } });
    const who = m.boss ? KING : ELDER;
    const ask = (text, items, right) => {
      const row = optRow(items, (v, wrap, b) => { wrap.querySelectorAll('button').forEach(x => { x.disabled = true; if (x.dataset.id === String(right)) x.classList.add('ok'); }); if (String(v) === String(right)) { got++; SFX.pop(); toast('옳다!'); } else { b.classList.add('no'); toast('아니다…'); } setTimeout(nextStep, 900); });
      setPanel(Object.assign({}, who, { text, body: row }));
    };
    const nextStep = () => {
      if (!G.live) return; stepNo++;
      if (stepNo === 2 && m.boss) return ask('달이 그 자리에 있는 날은 음력으로 며칠쯤인가?', [{ v: 1, label: '1일쯤', small: '삭' }, { v: 8, label: '8일쯤', small: '상현' }, { v: 15, label: '15일쯤', small: '망(보름)' }, { v: 22, label: '22일쯤', small: '하현' }], solar ? 1 : 15);
      if (stepNo === 2 || (stepNo === 3 && m.boss)) return ask(solar ? '일식이 시작되면 태양은 어느 쪽부터 가려지는가?' : '월식이 시작되면 달은 어느 쪽부터 가려지는가?', [{ v: 'L', label: '왼쪽(동쪽)부터' }, { v: 'R', label: '오른쪽(서쪽)부터' }], solar ? 'R' : 'L');
      end(false);
    };
    const go = el('button', 'btn', '여기다 ▶'), rr = el('div', 'right'); rr.append(go);
    go.onclick = () => {
      const E = Math.round(moonE(tool.L)) % 360, ok = E === (solar ? 0 : 180); SP.dragM = false; SP.snapM = false;
      if (ok) { got++; SFX.pop(); toast('옳다! ' + (solar ? '태양–달–지구' : '태양–지구–달') + ' 순서로 일직선.'); } else toast('아니다. ' + (solar ? '달이 태양과 지구 사이' : '달이 지구 뒤(태양 반대편)') + '에 와야 한다.', 2200);
      tool.L = solar ? 1 : 15; nextStep();
    };
    setPanel(Object.assign({}, who, { text: (m.boss ? '“오늘 일식이 있다 하였겠다. 틀림이 없으렷다?”\n' : '“붉은 달 소문의 정체를 밝혀라.”\n') + nm + '이 일어나려면 달은 어디에 있어야 하는가? 그림에서 달을 끌어다 놓아라.', hint: '달은 점선 동그라미 8곳 중 한 곳에 놓을 수 있다. 햇빛이 오는 쪽에 태양이 있다.', body: rr }));
    stepNo = 1; G.onTimeout = () => end(true);
  },
  /* G. 황도 12궁 — 지구 위치와 한밤중 별자리 */
  G(m) {
    const c = CON[ZOD[m.k]], opp = (m.k + 6) % 12, oc = CON[ZOD[opp]], mon = zodMonth(m.k); T = tool; tool.doy = doyOf(m.start, 1); tool.hour = 0;
    spCfg({ dragE: true, snapE: true, sunLine: false, months: false, d2: false }); setScene('space');
    let got = 0;
    const lines = ['태양은 ' + mon + '월 초에 ' + c.full + ' 앞을 지난다. 이때 ' + c.ko + '는 태양과 함께 뜨고 지므로 볼 수 없다.', '한밤중 남쪽 하늘에는 태양 반대편에 있는 ' + oc.full + '가 보인다. (6개월 뒤에는 반대가 된다)'];
    const end = (t, pick) => finish(got / 2 >= 0.99 ? 1 : got / 2, (t ? ['시간 초과!'] : []).concat(lines), () => {
      tool.doy = doyOf(mon, 1); tool.hour = 0; spCfg({ sunLine: true, months: true, obs: true, moon: false, hiZ: m.k, hiZ2: opp }); setScene('space');
      sky.doy = tool.doy; sky.hour = 0; sky.L = 1; sky.az = 180; sky.cloud = 0; sky.hi = oc.id; sky.labels = true; G.toolOK = true; G.keepSpace = true; setScene('space');
    });
    const go = el('button', 'btn', '여기다 ▶'), rr = el('div', 'right'); rr.append(go);
    go.onclick = () => {
      const ok = zodOfLon(sunLon(tool.doy)) === m.k; if (ok) { got++; SFX.pop(); toast('옳다!'); } else toast('아니다. 지구–태양–' + c.sh + '가 일직선이 되어야 한다.', 2200);
      tool.doy = doyOf(mon, 1); spCfg({ sunLine: true, months: true, d2: false, hiZ: m.k }); setScene('space');
      const cards = conCards(m.opts.map(k => ZOD[k]), (id, wrap) => { markCards(wrap, oc.id, id); if (id === oc.id) { got++; dexAdd(oc.id); } end(false, id); });
      setPanel(Object.assign({}, ELDER, { text: '태양은 ' + mon + '월 초에 ' + c.ko + ' 앞을 지난다.\n그렇다면 이 무렵 한밤중(자정), 남쪽 하늘에 보이는 별자리는?', hint: '한밤중의 관측자는 태양의 반대쪽을 향한다.', body: cards }));
    };
    setPanel(Object.assign({}, ELDER, { text: '“지구에서 보니 태양이 ' + c.ko + ' 앞을 지나고 있다.”\n이때 지구는 궤도 어디에 있는가? 그림에서 지구를 끌어다 놓아라.', hint: '지구에서 태양을 바라본 방향 너머에 그 별자리가 있어야 한다.', body: rr }));
    G.onTimeout = () => end(true);
  }
};

let fbExtra = null;
function finishWith(frac, lines, reveal, extra) { fbExtra = extra; finish(frac, lines, reveal); }
function finish(frac, lines, reveal) {
  if (!G.live) return; G.live = false; sky.hunt = false; G.onTap = null; G.onTimeout = null; G.keepSpace = false;
  const tf = G.tmax ? clamp(G.timer / G.tmax, 0, 1) : 0; let pts = 0, mult = 1;
  if (frac >= 1) { G.combo++; G.okN++; mult = 1 + Math.min(G.combo - 1, 5) * 0.2; } else { G.combo = 0; if (frac <= 0) G.missN++; }
  if (frac > 0) pts = Math.round(frac * (100 + 50 * tf) * mult);
  G.score += pts;
  if (frac <= 0) { if (!G.multi) G.strikes++; SFX.bad(); punish(); } else if (frac >= 1) SFX.ok(); else SFX.half();
  if (reveal) reveal();
  const rk = rankOf(G.score); if (!G.multi && rk > G.rank) { G.rank = rk; setTimeout(() => { toast('🎉 승진! ' + RANKS[rk][0] + '에 오르다', 2400); SFX.rank(); }, 900); }
  // 판정 패널
  G.fbOpen = true;
  const b = el('div', 'fb'), v = el('div', 'ver ' + (frac >= 1 ? 'ok' : frac > 0 ? 'half' : 'no'));
  v.textContent = frac >= 1 ? rpick(['“과연 관상감의 인재로다!”', '“옳거니, 틀림이 없구나!”', '“허허, 하늘을 손바닥 보듯 하는구나.”']) : frac > 0 ? '“절반은 맞았구나. 더 정진하라.”' : G.multi ? '“틀렸느니라. 다시 익히라.”' : '“여봐라, 곤장을 쳐라!” 철썩!';
  v.append(el('span', 'pts', '+' + pts + (mult > 1 ? '  연속 ×' + mult.toFixed(1) : '')));
  b.append(v); if (fbExtra) { b.append(fbExtra); fbExtra = null; }
  lines.forEach(s => { if (s) b.append(el('p', null, s)); });
  const last = G.idx + 1 >= G.list.length || (!G.multi && G.strikes >= 3);
  const nx = el('button', 'btn', last ? '결과 보기 ▶' : '다음 ▶'); nx.onclick = next;
  const r = el('div', 'right'); if (G.multi && window.boardRank) r.append(el('span', 'mine', boardRank())); r.append(nx); b.append(r);
  setPanel({ ava: frac > 0 ? '👑' : '🪵', who: frac > 0 ? '임금' : (G.multi ? '임금' : '곤장 ' + G.strikes + '/3'), body: b });
  $('#bScene').classList.toggle('hide', !G.toolOK); updateHUD();
  if (G.multi && window.clientReport) clientReport();
}
function next() {
  G.fbOpen = false; SFX.pop();
  if (!G.multi && G.strikes >= 3) return endGame(false);
  G.idx++; if (G.idx >= G.list.length) return endGame(true);
  startMission();
}
function startMission() {
  const m = G.list[G.idx]; G.cur = m; resetStage(); G.tmax = G.timer = m.time || 0; G.live = true;
  MT[m.type](m); setScene(scene); updateHUD();
}
function startGame(list, multi) {
  Object.assign(G, { mode: multi ? 'multi' : 'story', list, idx: 0, score: 0, combo: 0, strikes: 0, okN: 0, missN: 0, multi: !!multi, rank: 0, act: '', total: list.filter(m => m.type !== 'ACT').length, fbOpen: false });
  screenEl.innerHTML = ''; screenEl.classList.add('hide'); hud.classList.remove('hide'); $('#hLife').classList.remove('hide');
  startMission();
}
function endGame(win) {
  G.live = false; resetStage(); panel.classList.add('hide'); sky.labels = true; sky.hour = 23;
  const box = el('div', 'box'), sc = el('div', 'scroll');
  if (G.multi) {
    G.done = true; if (window.clientReport) clientReport();
    sc.append(el('h2', null, '과거 시험 종료'), el('div', 'big', G.score + '점'));
    const st = el('div', 'stat'); st.append(statCell('정답', G.okN), statCell('오답', G.missN)); sc.append(st);
    const rk = el('p', null, ''); rk.id = 'myRank'; rk.style.textAlign = 'center'; rk.textContent = window.boardRank ? boardRank() : ''; sc.append(rk, el('p', null, '선생님 화면에서 방(榜)을 확인하세요. 시험이 끝날 때까지 이 화면을 유지해 주세요.'));
    const c = el('div', 'ctr'), b = el('button', 'btn', '처음으로'); b.onclick = () => { if (window.netClose) netClose(); showTitle(); }; c.append(b); sc.append(c);
  } else {
    const best = G.score > SAVE.best; if (best) { SAVE.best = G.score; save(); }
    sc.append(el('h2', null, win ? '구식례를 마치다' : '파직(罷職)…'));
    sc.append(el('p', null, win ? '해가 다시 온전히 드러나자 북소리가 멎었다. 임금이 그대를 돌아보며 웃는다.' : '곤장 세 대. 그대는 봇짐을 싸서 관상감을 떠난다. 하지만 하늘은 내일 밤에도 그 자리에 있다.'));
    sc.append(el('div', 'big', RANKS[rankOf(G.score)][0]));
    const st = el('div', 'stat'); st.append(statCell('점수', G.score), statCell('정답', G.okN), statCell('곤장', G.strikes), statCell('최고 기록', SAVE.best)); sc.append(st);
    if (best) sc.append(el('p', null, '🎉 새 최고 기록!'));
    const c = el('div', 'ctr'), b1 = el('button', 'btn', '다시 도전'), b2 = el('button', 'btn gold', '처음으로');
    b1.onclick = () => startStory(); b2.onclick = showTitle; c.append(b1, b2); sc.append(c);
    if (win) SFX.rank(); else SFX.gong();
  }
  box.append(sc); showScreen(box); hud.classList.add('hide'); G.mode = 'end';
}
function statCell(k, v) { const d = el('div'); d.append(el('b', null, v), document.createTextNode(k)); return d; }

/* ───────── 화면 ───────── */
function showScreen(node, clear) { screenEl.innerHTML = ''; screenEl.append(node); screenEl.classList.remove('hide'); screenEl.classList.toggle('clear', !!clear); screenEl.scrollTop = 0; }
function showTitle() {
  G.mode = 'title'; G.multi = false; G.live = false; G.done = false; resetStage(); panel.classList.add('hide'); hud.classList.add('hide'); toolbar.classList.add('hide'); dirpad.classList.add('hide');
  const d = new Date(), doy = doyOf(d.getMonth() + 1, Math.min(d.getDate(), MDAYS[d.getMonth()]));
  Object.assign(sky, { doy, hour: 21, L: 9, az: 180, alt: ALT0, labels: true });
  const box = el('div', 'box');
  box.append(el('h1', 'logo', '별지기'), el('div', 'logo-en', 'STARWATCH'), el('div', 'sub', '조선 관상감 천문관 이야기\n하늘을 읽으면 승진, 틀리면 곤장!'));
  box.querySelector('.sub').style.whiteSpace = 'pre-line';
  const menu = el('div', 'menu');
  const add = (label, small, cls, fn) => { const b = el('button', 'btn ' + (cls || '')); b.append(document.createTextNode(label)); if (small) b.append(el('small', null, small)); b.onclick = () => { au(); SFX.pop(); fn(); }; menu.append(b); };
  add('이야기 모드', '혼자서 — 생도에서 관상감 정까지', 'gold', showIntro);
  add('과거 시험 (교실 대결)', '방 코드로 다 함께 — 실시간 순위', '', () => window.showMulti && showMulti());
  add('천문대 — 자유 관측', '날짜·시각·달을 마음대로 돌려 보기', 'ghost', startSandbox);
  add('별자리 도감', Object.keys(SAVE.dex).length + ' / ' + CONS.length + ' 수집', 'ghost', showDex);
  box.append(menu);
  box.append(el('div', 'foot', (SAVE.best ? '최고 기록 ' + SAVE.best + '점 · ' : '') + '황도 12궁 · 계절과 시각별 별자리 · 달의 위상 · 일식과 월식'));
  showScreen(box);
}
function showIntro() {
  const box = el('div', 'box'), sc = el('div', 'scroll');
  sc.append(el('h2', null, '세종 4년(1422) 정월 초하루'));
  sc.append(el('p', null, '일식이 일어났다. 임금은 흰 옷을 입고 인정전 월대에 올라 해를 구하는 의식을 치렀고, 해는 다시 빛을 되찾았다. 그런데 일식이 예보보다 1각(약 15분) 어긋나 있었다. 계산을 맡았던 술자 이천봉은 그 벌로 곤장을 맞았다.'));
  sc.append(el('div', 'cite', '— 『세종실록』에 전하는 실제 사건'));
  sc.append(el('p', null, '예보가 15분 틀렸다고 곤장을 맞던 시절. 하늘을 읽는 관청 관상감(서운관)에 신참 생도 하나가 들어온다. 바로 그대다.'));
  sc.append(el('p', null, '별자리가 뜨는 계절과 시각, 달의 모양과 자리, 일식과 월식 — 임금의 물음에 정확히 답해 관상감의 으뜸 벼슬 ‘정(正)’까지 올라라. 곤장 세 대면 파직이다.'));
  const c = el('div', 'ctr'), b = el('button', 'btn', '관상감에 들어간다 ▶'), b0 = el('button', 'btn gold', '돌아가기');
  b.onclick = () => startStory(); b0.onclick = showTitle; c.append(b0, b); sc.append(c); box.append(sc); showScreen(box);
}
function startStory() { startGame(buildCampaign((Math.random() * 2 ** 31) | 0), false); }
function showDex() {
  const box = el('div', 'box wide'), sc = el('div', 'scroll');
  sc.append(el('h2', null, '별자리 도감  ' + Object.keys(SAVE.dex).length + ' / ' + CONS.length));
  sc.append(el('p', null, '임무에서 별자리를 정확히 맞히면 도감에 기록된다. 눌러서 설명을 읽어 보자.'));
  const info = el('p', null, ''); info.style.minHeight = '3.2em'; info.style.fontWeight = '700';
  const grid = el('div', 'dex');
  CONS.forEach(c => { const has = SAVE.dex[c.id], b = el('button', 'card' + (has ? '' : ' lock')), cvs = document.createElement('canvas'); cvs.width = cvs.height = 120; drawThumb(cvs, c); b.append(cvs, el('span', null, has ? c.full : '???')); b.onclick = () => { info.textContent = has ? c.full + ' (' + c.season + ') — ' + c.note : '아직 기록되지 않은 별자리. 임무에서 찾아내자!'; }; grid.append(b); });
  const ctr = el('div', 'ctr'), b0 = el('button', 'btn gold', '돌아가기'); b0.onclick = showTitle; ctr.append(b0);
  sc.append(grid, info, ctr); box.append(sc); showScreen(box);
}
/* 자유 관측 */
let SBX = null;
function startSandbox() {
  G.mode = 'sandbox'; G.multi = false; G.live = false; resetStage(); T = sky; G.toolOK = true; G.dirpad = true; sky.labels = true; G.play = false;
  sky.hour = 21; sky.L = 8; sky.az = 180;
  screenEl.innerHTML = ''; screenEl.classList.add('hide'); hud.classList.remove('hide'); $('#hLife').textContent = ''; $('#hRank').textContent = '천문대'; $('#hScore').textContent = ''; $('#hCombo').textContent = ''; $('#hProg').textContent = '천문대 — 자유 관측';
  const g = el('div', 'ctrl');
  const mk = (name, min, max, step, get, set, fmt) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; const v = el('span', 'v'); i.oninput = () => { set(+i.value); v.textContent = fmt(); }; g.append(el('span', null, name), i, v); return { sync() { if (document.activeElement !== i) i.value = get(); v.textContent = fmt(); } }; };
  const a = mk('날짜', 1, 365, 1, () => sky.doy, v => sky.doy = v, () => dateStr(sky.doy));
  const b = mk('시각', 0, 23.75, 0.25, () => mod(sky.hour, 24), v => sky.hour = v, () => { const h = mod(sky.hour, 24), hh = Math.floor(h), mm = Math.round((h - hh) * 60); return hh + '시' + (mm ? ' ' + mm + '분' : ''); });
  const c = mk('음력', 1, 29, 0.5, () => sky.L, v => sky.L = v, () => Math.floor(sky.L) + '일 · ' + MOON_NAME(sky.L));
  SBX = { sync() { a.sync(); b.sync(); c.sync(); } };
  const row = el('div', 'opts'); row.style.marginTop = '8px';
  const tg = (label, fn, on) => { const x = el('button', 'opt' + (on ? ' sel' : ''), label); x.style.padding = '7px 4px'; x.onclick = () => { SFX.pop(); fn(x); }; row.append(x); return x; };
  tg('이름표', x => { sky.labels = !sky.labels; x.classList.toggle('sel', sky.labels); }, true);
  tg('▶ 하루의 움직임', x => { G.play = G.play === 'day' ? false : 'day'; row.querySelectorAll('.pl').forEach(y => y.classList.remove('sel')); x.classList.toggle('sel', G.play === 'day'); }).classList.add('pl');
  tg('▶ 일 년의 움직임', x => { G.play = G.play === 'year' ? false : 'year'; row.querySelectorAll('.pl').forEach(y => y.classList.remove('sel')); x.classList.toggle('sel', G.play === 'year'); }).classList.add('pl');
  tg('▶ 한 달의 달', x => { G.play = G.play === 'moon' ? false : 'moon'; row.querySelectorAll('.pl').forEach(y => y.classList.remove('sel')); x.classList.toggle('sel', G.play === 'moon'); }).classList.add('pl');
  const body = el('div'); body.append(g, row);
  setPanel({ ava: '🔭', who: '천문대', hint: '하늘을 끌어 돌려 보고, [🌐 혼천의]에서 지구·관측자·달을 직접 움직여 보자. ‘일 년의 움직임’은 매일 같은 시각의 하늘, ‘한 달의 달’은 매일 같은 시각의 달이다.', body });
  setScene('sky'); SBX.sync();
}

/* ───────── 입력 ───────── */
let PD = null;
cv.addEventListener('pointerdown', e => {
  au(); PD = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, mode: null };
  if (scene === 'space') { PD.mode = spacePick(e.clientX, e.clientY); if (PD.mode && spaceDrag(PD.mode, e.clientX, e.clientY)) SFX.tick(); }
  else PD.mode = 'pan';
  try { cv.setPointerCapture(e.pointerId); } catch (err) { }
});
cv.addEventListener('pointermove', e => {
  if (!PD) return; const dx = e.clientX - PD.x, dy = e.clientY - PD.y; PD.x = e.clientX; PD.y = e.clientY;
  if (Math.hypot(e.clientX - PD.x0, e.clientY - PD.y0) > 7) PD.moved = true;
  if (scene === 'space') { if (PD.mode && spaceDrag(PD.mode, e.clientX, e.clientY)) SFX.tick(); }
  else if (PD.moved && !sky.lock && !sky.ecl) { killTweens(sky, 'az'); killTweens(sky, 'alt'); sky.az = mod(sky.az - dx / V.sc / RAD / Math.max(0.4, Math.cos(sky.alt * RAD)), 360); sky.alt = clamp(sky.alt + dy / V.sc / RAD, 8, 74); }
});
function pointerEnd(e) {
  if (!PD) return; const p = PD; PD = null;
  if (p.moved || scene !== 'sky') return;
  if (SSTAR && !SSTAR.hit && Math.hypot(SSTAR.hx - p.x, SSTAR.hy - p.y) < 80) { SSTAR.hit = true; SFX.star(); if (G.live && (G.mode === 'story' || G.mode === 'multi')) { G.score += 30; updateHUD(); toast('🌠 별똥별이다! 길조로다 +30'); } else toast('🌠 별똥별!'); return; }
  if (G.onTap) G.onTap(p.x, p.y);
}
cv.addEventListener('pointerup', pointerEnd); cv.addEventListener('pointercancel', () => { PD = null; });
dirpad.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; SFX.tick(); tweenAz(+b.dataset.az, 600); tween(sky, 'alt', ALT0, 600); });
toolbar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k, d = +b.dataset.d; SFX.tick();
  if (k === 'doy') T.doy = mod(Math.round(T.doy) + d - 1, 365) + 1; else if (k === 'hour') T.hour = mod(Math.round(T.hour) + d, 24); else T.L = mod(Math.round(T.L) + d - 1, 29) + 1;
});
$('#bScene').onclick = () => { SFX.pop(); if (scene === 'sky') { if (!G.keepSpace && !(G.fbOpen && G.cur && G.cur.type === 'G')) spCfg({ free: true, dragE: true, dragM: true, dragO: true }); setScene('space'); } else setScene('sky'); };
$('#bSnd').onclick = () => { AU.on = !AU.on; $('#bSnd').textContent = AU.on ? '🔊' : '🔇'; };
let quitT = 0;
$('#bQuit').onclick = () => {      // 한 번 더 눌러야 나간다 (실수 방지)
  if (G.mode === 'sandbox' || Date.now() - quitT < 2500) { quitT = 0; if (window.netClose) netClose(); showTitle(); }
  else { quitT = Date.now(); toast('한 번 더 누르면 처음 화면으로 나갑니다', 2300); }
};

/* ───────── 메인 루프 ───────── */
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now; const t = now / 1000;
  stepTweens(now);
  const hudOn = !hud.classList.contains('hide'), tbOn = !toolbar.classList.contains('hide'), pOn = !panel.classList.contains('hide');
  const hh = hudOn ? hud.offsetHeight : 0, land = W >= 900 && W > H * 1.25;
  if (land !== document.body.classList.contains('land')) document.body.classList.toggle('land', land);
  panel.style.top = land ? hh + 'px' : '';
  UI.right = land && pOn ? panel.offsetWidth : 0; UI.bot = !land && pOn ? Math.min(panel.offsetHeight, H * 0.7) : 0;
  if (tbOn) { toolbar.style.top = hh + 'px'; toolbar.style.right = UI.right + 'px'; }
  UI.top = hh + (tbOn ? toolbar.offsetHeight : 0);
  if (!dirpad.classList.contains('hide')) { dirpad.style.bottom = (UI.bot + 54) + 'px'; dirpad.style.right = (UI.right + 10) + 'px'; }
  $('#toast').style.left = (W - UI.right) / 2 + 'px';
  if (tbOn) { $('#tDate').textContent = dateStr(T.doy); $('#tHour').textContent = hourStr(T.hour); $('#tMoon').textContent = '음력 ' + Math.floor(T.L) + '일'; }
  // 모드별 갱신
  if (G.mode === 'title' || G.mode === 'end' || G.mode === 'lobby') { sky.hour += dt * 0.12; sky.az = mod(sky.az + dt * 1.2, 360); }
  if (G.mode === 'sandbox') {
    if (G.play === 'day') sky.hour = mod(sky.hour + dt * 1.5, 24); else if (G.play === 'year') sky.doy = mod(sky.doy + dt * 18 - 1, 365) + 1; else if (G.play === 'moon') { sky.L += dt * 2.2; if (sky.L >= 29.5) sky.L = 1; }
    if (SBX) SBX.sync();
  }
  if (G.live && G.tmax > 0) { const b = G.timer; G.timer -= dt; if (b > 10 && G.timer <= 10) toast('⏳ 10초 남았다!', 1000); if (G.timer <= 10 && Math.floor(b) !== Math.floor(G.timer)) SFX.tick(); if (G.timer <= 0) { G.timer = 0; if (G.onTimeout) G.onTimeout(); } }
  $('#hTime').style.transform = 'scaleX(' + (G.tmax > 0 && (G.live || G.fbOpen) ? clamp(G.timer / G.tmax, 0, 1) : 0) + ')';
  // 별똥별
  if (scene === 'sky' && !SSTAR && sky.cloud < 0.05 && S.sa > 0.8 && !sky.ecl && ((G.live && G.cur && G.cur.type === 'A') || G.mode === 'sandbox' || G.mode === 'title') && Math.random() < dt * 0.045) {
    const ah = H - UI.top - UI.bot, x0 = (W - UI.right) * (0.15 + 0.7 * Math.random()), y0 = UI.top + ah * (0.06 + 0.3 * Math.random()), a = (25 + 40 * Math.random()) * RAD, len = 240 + 160 * Math.random(), dir = Math.random() < 0.5 ? -1 : 1;
    SSTAR = { t0: now, dur: 1500, x0, y0, x1: x0 + Math.cos(a) * len * dir, y1: y0 + Math.sin(a) * len, hx: x0, hy: y0, hit: false };
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (scene === 'sky') drawSky(t, dt); else drawSpace(t);
}
resize(); showTitle(); requestAnimationFrame(frame);
