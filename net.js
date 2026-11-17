'use strict';
/* 별지기 · STARWATCH — 교실 대결(과거 시험)
   자체 서버 없이 공개 MQTT 중계 서버 3곳을 동시에 사용한다.
   선생님 기기가 방(4자리 코드)을 열어 본부 역할을 하고, 학생 기기는 같은 시드로 같은 문제를 푼 뒤 점수만 보낸다. */
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const NET = { clients: [], seen: new Set(), base: '', onUp: null, t0: 0 };
const netSlow = () => !netUp() && Date.now() - NET.t0 > 10000;      // 10초가 지나도 연결이 안 됨
const NET_FAIL = '⚠ 중계 서버에 연결되지 않습니다. 학교 방화벽이나 미리보기 주소가 실시간 연결(WebSocket)을 막고 있을 수 있습니다. 다른 네트워크(휴대폰 핫스팟 등)에서 다시 시도해 보세요.';
const HOST = { on: false, code: '', n: 12, seed: 0, phase: 'lobby', players: new Map(), iv: 0, rv: 0, dirty: false };
const CLI = { on: false, id: '', name: '', code: '', phase: '', board: [], iv: 0, started: false, ended: false };

function loadMqtt() {
  return new Promise((res, rej) => {
    if (window.mqtt) return res();
    const urls = ['https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js'];
    const tryLoad = i => { if (i >= urls.length) return rej(new Error('mqtt')); const s = document.createElement('script'); s.src = urls[i]; s.onload = () => window.mqtt ? res() : tryLoad(i + 1); s.onerror = () => tryLoad(i + 1); document.head.append(s); };
    tryLoad(0);
  });
}
const netUp = () => NET.clients.filter(c => c.connected).length;
async function netOpen(code, sub, onMsg) {
  netDrop(); NET.t0 = Date.now(); await loadMqtt();
  NET.base = 'starwatch-kr/v1/' + code;
  for (const url of BROKERS) {
    try {
      const c = window.mqtt.connect(url, { clientId: 'sw_' + Math.random().toString(36).slice(2, 12), keepalive: 30, reconnectPeriod: 4000, connectTimeout: 9000, clean: true });
      c.on('connect', () => { c.subscribe(NET.base + '/' + sub); if (NET.onUp) NET.onUp(); });
      c.on('close', () => { if (NET.onUp) NET.onUp(); });
      c.on('error', () => { });
      c.on('message', (topic, payload) => {
        let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
        if (!m || typeof m !== 'object' || typeof m.mid !== 'string' || NET.seen.has(m.mid)) return;
        if (NET.seen.size > 6000) NET.seen.clear(); NET.seen.add(m.mid); onMsg(m);
      });
      NET.clients.push(c);
    } catch (e) { }
  }
}
function netSend(ch, obj) { obj.mid = Math.random().toString(36).slice(2) + Date.now().toString(36); const s = JSON.stringify(obj); NET.clients.forEach(c => { if (c.connected) { try { c.publish(NET.base + '/' + ch, s); } catch (e) { } } }); }
function netDrop() { NET.clients.forEach(c => { try { c.end(true); } catch (e) { } }); NET.clients = []; NET.seen.clear(); }
function netClose() { clearInterval(HOST.iv); clearInterval(HOST.rv); clearInterval(CLI.iv); HOST.on = false; CLI.on = false; CLI.started = CLI.ended = false; NET.onUp = null; netDrop(); }

function scrollBox(wide) { const box = el('div', 'box' + (wide ? ' wide' : '')), sc = el('div', 'scroll'); box.append(sc); return { box, sc }; }
function backBtn(label, fn) { const b = el('button', 'btn gold', label || '돌아가기'); b.onclick = fn || (() => { netClose(); showTitle(); }); return b; }

/* ───────── 메뉴 ───────── */
function showMulti() {
  const { box, sc } = scrollBox();
  sc.append(el('h2', null, '과거 시험 — 교실 대결'));
  sc.append(el('p', null, '관상감 관원을 뽑는 과거 시험! 모두 같은 문제를 각자 기기에서 풀고, 선생님 화면에 실시간 순위(방, 榜)가 뜬다. 빠르고 정확할수록, 연속으로 맞힐수록 점수가 높다.'));
  const c = el('div', 'ctr'), b1 = el('button', 'btn', '방 만들기 (선생님)'), b2 = el('button', 'btn', '참가하기 (학생)');
  b1.onclick = hostSetup; b2.onclick = joinForm; c.append(b1, b2, backBtn()); sc.append(c); showScreen(box);
}

/* ───────── 선생님(본부) ───────── */
function hostSetup() {
  const { box, sc } = scrollBox(); let n = 12;
  sc.append(el('h2', null, '방 만들기'), el('p', null, '문제 수를 고르고 방을 연다. 이 화면은 교실 큰 화면에 띄워 두면 좋다. (마지막 문제는 언제나 일식 예보)'));
  const seg = el('div', 'seg'); [[8, '8문제 · 약 7분'], [12, '12문제 · 약 10분'], [16, '16문제 · 약 14분']].forEach(([v, l]) => { const b = el('button', v === n ? 'sel' : '', l); b.onclick = () => { n = v; seg.querySelectorAll('button').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); }; seg.append(b); });
  const c = el('div', 'ctr'), go = el('button', 'btn', '방 열기 ▶'); go.onclick = () => hostOpen(n); c.append(backBtn('돌아가기', showMulti), go); sc.append(seg, c); showScreen(box);
}
async function hostOpen(n) {
  netClose();
  Object.assign(HOST, { on: true, warned: false, code: String(1000 + Math.floor(Math.random() * 9000)), n, seed: (Math.random() * 2 ** 31) | 0, phase: 'lobby', dirty: true }); HOST.players.clear();
  G.mode = 'lobby'; renderHost();
  NET.onUp = () => { HOST.dirty = true; };
  try { await netOpen(HOST.code, 'c', hostMsg); } catch (e) { HOST.err = true; renderHost(); return; }
  HOST.err = false;
  HOST.iv = setInterval(() => { if (HOST.on) netSend('h', { t: 'state', phase: HOST.phase, seed: HOST.seed, n: HOST.n, board: hostBoard() }); }, 1500);
  HOST.rv = setInterval(() => { if (HOST.on && (HOST.dirty || (HOST.phase === 'lobby' && netSlow() && !HOST.warned))) renderHost(); }, 700);
}
function hostMsg(m) {
  if (m.t !== 'me' || typeof m.id !== 'string') return;
  const id = m.id.slice(0, 24); if (!HOST.players.has(id) && HOST.players.size >= 80) return;
  HOST.players.set(id, { name: String(m.name || '무명').slice(0, 10), score: clamp(m.score | 0, 0, 99999), idx: clamp(m.idx | 0, 0, 99), done: !!m.done });
  HOST.dirty = true;
}
function hostBoard() { return [...HOST.players].map(([id, p]) => ({ id, name: p.name, score: p.score, idx: p.idx, done: p.done })).sort((a, b) => b.score - a.score || b.idx - a.idx); }
function boardTable(list, n, meId, limit) {
  const tb = el('table', 'board');
  list.slice(0, limit || 99).forEach((p, i) => {
    const tr = el('tr', p.id === meId ? 'me' : ''), pg = el('td', 'p'), pb = el('div', 'pb'), bar = el('i');
    bar.style.width = clamp((p.done ? n : p.idx) / n * 100, 0, 100) + '%'; pb.append(bar); pg.append(pb);
    tr.append(el('td', 'n', i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1)), el('td', null, String(p.name)), pg, el('td', 's', String(p.score | 0)));
    tb.append(tr);
  });
  return tb;
}
function renderHost() {
  HOST.dirty = false; if (!HOST.on) return;
  const { box, sc } = scrollBox(true), list = hostBoard(), up = netUp();
  if (HOST.phase === 'lobby') {
    sc.append(el('h2', null, '과거 시험장'), el('div', 'code', HOST.code));
    const p = el('p', null, '학생: 게임 첫 화면 → 과거 시험 → 참가하기 → 이름과 위의 방 코드 입력'); p.style.textAlign = 'center'; sc.append(p);
    const st = el('p', null, HOST.err ? '⚠ 중계 서버 프로그램을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.' : up ? '중계 서버 연결됨 (' + up + '/3) · 응시생 ' + list.length + '명' : netSlow() ? NET_FAIL : '중계 서버에 연결하는 중…'); HOST.warned = netSlow(); st.style.textAlign = 'center'; st.style.fontSize = '14px'; sc.append(st);
    const chips = el('div', 'chips'); list.forEach(p => chips.append(el('span', 'chip', String(p.name)))); sc.append(chips);
    const c = el('div', 'ctr'), go = el('button', 'btn', '시험 시작 ▶ (' + HOST.n + '문제)'); go.disabled = !list.length;
    go.onclick = () => { HOST.phase = 'play'; SFX.gong(); netSend('h', { t: 'state', phase: 'play', seed: HOST.seed, n: HOST.n, board: hostBoard() }); renderHost(); };
    c.append(backBtn('방 닫기'), go); sc.append(c);
  } else if (HOST.phase === 'play') {
    const done = list.filter(p => p.done).length;
    sc.append(el('h2', null, '방(榜) — 실시간 순위'));
    const p = el('p', null, '방 코드 ' + HOST.code + ' · 응시 ' + list.length + '명 · 완료 ' + done + '명'); p.style.textAlign = 'center'; p.style.fontSize = '14px'; sc.append(p);
    const wrap = el('div'); wrap.style.maxHeight = '56vh'; wrap.style.overflow = 'auto'; wrap.append(boardTable(list, HOST.n)); sc.append(wrap);
    const c = el('div', 'ctr'), end = el('button', 'btn', '시험 종료 · 방 붙이기'); end.onclick = () => { HOST.phase = 'end'; SFX.rank(); netSend('h', { t: 'state', phase: 'end', seed: HOST.seed, n: HOST.n, board: hostBoard() }); renderHost(); }; c.append(end); sc.append(c);
  } else {
    sc.append(el('h2', null, '급제자 발표'));
    if (list[0]) { sc.append(el('div', 'big', '장원 급제 · ' + list[0].name)); const s = el('p', null, list[0].score + '점'); s.style.textAlign = 'center'; sc.append(s); }
    const wrap = el('div'); wrap.style.maxHeight = '46vh'; wrap.style.overflow = 'auto'; wrap.append(boardTable(list, HOST.n)); sc.append(wrap);
    const c = el('div', 'ctr'); c.append(backBtn('처음으로')); sc.append(c);
  }
  showScreen(box);
}

/* ───────── 학생 ───────── */
function joinForm(msg) {
  const { box, sc } = scrollBox();
  sc.append(el('h2', null, '과거 시험 참가'));
  if (typeof msg === 'string') sc.append(el('p', null, msg));
  const nm = el('input', 'tx'), cd = el('input', 'tx'); nm.placeholder = '이름 (10자까지)'; nm.maxLength = 10; nm.value = CLI.name || ''; cd.placeholder = '방 코드 4자리'; cd.maxLength = 4; cd.inputMode = 'numeric';
  const c = el('div', 'ctr'), go = el('button', 'btn', '입장 ▶');
  go.onclick = () => { const name = nm.value.trim(), code = cd.value.trim(); if (!name) return toast('이름을 적어 주세요'); if (!/^\d{4}$/.test(code)) return toast('방 코드는 숫자 4자리'); cliJoin(name, code); };
  c.append(backBtn('돌아가기', showMulti), go); sc.append(nm, cd, c); showScreen(box);
}
async function cliJoin(name, code) {
  netClose();
  Object.assign(CLI, { on: true, id: Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4), name, code, phase: '', board: [], started: false, ended: false });
  G.mode = 'lobby'; G.multi = false; G.done = false; renderWait();
  NET.onUp = () => { if (CLI.on && !CLI.started) renderWait(); clientReport(); };
  try { await netOpen(code, 'h', cliMsg); } catch (e) { netClose(); return joinForm('⚠ 중계 서버 프로그램을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); }
  CLI.iv = setInterval(clientReport, 2000); clientReport();
  setTimeout(() => { if (CLI.on && !CLI.started && netSlow()) renderWait(); }, 10600);
}
function clientReport() { if (!CLI.on) return; netSend('c', { t: 'me', id: CLI.id, name: CLI.name, score: G.multi ? G.score : 0, idx: G.multi ? (G.done ? G.list.length : G.idx) : 0, done: !!(G.multi && G.done) }); }
function renderWait() {
  const { box, sc } = scrollBox(), joined = CLI.board.some(p => p.id === CLI.id), up = netUp();
  sc.append(el('h2', null, '시험장 대기 중'), el('div', 'big', CLI.name));
  const p = el('p', null, !up ? (netSlow() ? NET_FAIL : '중계 서버에 연결하는 중…') : joined ? '입장 완료! 선생님이 시험을 시작하면 바로 문제가 나온다. (응시생 ' + CLI.board.length + '명)' : '방 ' + CLI.code + '을(를) 찾는 중… 코드가 맞는지 확인하세요.'); p.style.textAlign = 'center'; sc.append(p);
  const c = el('div', 'ctr'); c.append(backBtn('나가기')); sc.append(c); showScreen(box);
}
function cliMsg(m) {
  if (m.t !== 'state' || !CLI.on) return;
  CLI.board = Array.isArray(m.board) ? m.board.filter(p => p && typeof p === 'object').slice(0, 80) : []; CLI.phase = m.phase;
  if (m.phase === 'lobby' && !CLI.started) renderWait();
  if (m.phase === 'play' && !CLI.started) { CLI.started = true; G.done = false; startGame(buildMulti(m.seed | 0, clamp(m.n | 0, 4, 24)), true); clientReport(); }
  if (m.phase === 'end' && !CLI.ended) { CLI.ended = true; showFinal(clamp(m.n | 0, 4, 24)); return; }
  if (G.multi) { updateHUD(); const e = $('#myRank'); if (e) e.textContent = boardRank(); }
}
function boardRank() { const i = CLI.board.findIndex(p => p.id === CLI.id); return i < 0 ? '' : '현재 ' + (i + 1) + '위 / ' + CLI.board.length + '명'; }
function showFinal(n) {
  G.live = false; G.fbOpen = false; resetStage(); panel.classList.add('hide'); hud.classList.add('hide'); G.mode = 'end'; sky.labels = true;
  const { box, sc } = scrollBox(true), i = CLI.board.findIndex(p => p.id === CLI.id);
  sc.append(el('h2', null, '급제자 발표'));
  if (i >= 0) { sc.append(el('div', 'big', (i === 0 ? '장원 급제! ' : (i + 1) + '위 · ') + CLI.name)); const s = el('p', null, (CLI.board[i].score | 0) + '점 / ' + CLI.board.length + '명 중'); s.style.textAlign = 'center'; sc.append(s); if (i < 3) SFX.rank(); }
  const wrap = el('div'); wrap.style.maxHeight = '42vh'; wrap.style.overflow = 'auto'; wrap.append(boardTable(CLI.board, n, CLI.id, 30)); sc.append(wrap);
  const c = el('div', 'ctr'); c.append(backBtn('처음으로')); sc.append(c); showScreen(box);
}
