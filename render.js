'use strict';
/* 별지기 · STARWATCH — 그리기 (하늘 장면 / 혼천의 장면) */
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
window.addEventListener('resize', resize);

const FONT = '"Gowun Batang","Nanum Myeongjo","Apple SD Gothic Neo","Malgun Gothic",serif';
const UI = { top: 0, bot: 0, right: 0 };    // 캔버스를 가리는 위·아래·오른쪽 UI 크기
const ALT0 = 20;                             // 기본 시선 고도
let scene = 'sky';

/* ───────── 상태 ───────── */
const sky = { doy: 80, hour: 22, L: 10, az: 180, alt: ALT0, wide: 0, labels: false, cloud: 0, hi: null, ghost: null, moonLabel: '', hunt: false, ecl: null, lock: false, hideMoon: false };
const tool = { doy: 80, hour: 0, L: 15 };   // 혼천의(도구) 상태
let T = tool;                                // 혼천의가 보여 주는 상태 (자유 관측에서는 sky)
const SP = { free: true, dragE: true, dragM: true, dragO: true, snapE: false, snapM: false, sunLine: true, months: true, obs: true, moon: true, hiZ: -1, hiZ2: -1, d1: true, d2: true };
function spCfg(o) { Object.assign(SP, { free: false, dragE: false, dragM: false, dragO: false, snapE: false, snapM: false, sunLine: true, months: true, obs: true, moon: true, hiZ: -1, hiZ2: -1, d1: true, d2: true }, o || {}); }

const V = { cx: 0, cy: 0, sc: 300, f: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] };
const S = { lst: 0, sun: { alt: 0, az: 0 }, moon: { alt: 0, az: 0 }, sa: 1 };

/* 배경 별 (장식) */
const BG = (() => { const r = mulberry32(20261118), a = []; for (let i = 0; i < 520; i++) { const z = r() * 2 - 1, p = r() * 360; a.push({ ra: p, dec: Math.asin(z) / RAD, b: 0.25 + r() * 0.55, ph: r() * TAU, sz: 0.5 + r() * 0.8 }); } return a; })();
const CLB = (() => { const r = mulberry32(7), a = []; for (let i = 0; i < 30; i++) a.push({ x: r(), y: r() * 0.85, r: 0.14 + r() * 0.2, v: 0.004 + r() * 0.012 }); return a; })();
const BLD = [{ az: 128, w: 7, h: 6.2 }, { az: 236, w: 5, h: 5 }, { az: 24, w: 6, h: 5.6 }, { az: 302, w: 4.5, h: 4.6 }, { az: 68, w: 3, h: 3.8 }];
function terrain(az) {
  az = mod(az, 360);
  let h = 1.7 + 1.1 * Math.sin(az * RAD * 3 + 1) + 0.8 * Math.sin(az * RAD * 7 + 2.2) + 0.45 * Math.sin(az * RAD * 13 + 0.7);
  for (const b of BLD) {
    const d = Math.abs(angDiff(az, b.az));
    if (d < b.w) { const u = d / b.w; let hh = u < 0.3 ? b.h : b.h * (1 - (u - 0.3) / 0.7 * 0.62); if (u > 0.9) hh += b.h * 0.07; if (u < 0.06) hh += b.h * 0.12; h = Math.max(h, hh); }
  }
  return Math.max(0.5, h);
}

function setView() {
  const a = sky.az * RAD, h = sky.alt * RAD, ch = Math.cos(h), sh = Math.sin(h), sa = Math.sin(a), ca = Math.cos(a);
  V.f = [ch * sa, ch * ca, sh]; V.r = [ca, -sa, 0]; V.u = [-sh * sa, -sh * ca, ch];
}
function projV(x, y, z) {
  const Z = x * V.f[0] + y * V.f[1] + z * V.f[2];
  if (Z < -0.55) return null;
  const k = 2 / (1 + Z) * V.sc;
  return { x: V.cx + (x * V.r[0] + y * V.r[1]) * k, y: V.cy - (x * V.u[0] + y * V.u[1] + z * V.u[2]) * k };
}
function proj(az, alt) { const a = az * RAD, h = alt * RAD, ch = Math.cos(h); return projV(ch * Math.sin(a), ch * Math.cos(a), Math.sin(h)); }
function vecOf(az, alt) { const a = az * RAD, h = alt * RAD, ch = Math.cos(h); return [ch * Math.sin(a), ch * Math.cos(a), Math.sin(h)]; }

const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')';
const STARCOL = { r: [255, 150, 120], o: [255, 190, 120], y: [255, 240, 190], b: [190, 215, 255], p: [200, 220, 255], '': [235, 240, 255] };

/* ───────── 달 그리기 ───────── */
function drawMoonDisc(c, x, y, r, E, ang, alpha) {
  c.save(); c.translate(x, y); c.rotate(ang); c.globalAlpha = alpha == null ? 1 : alpha;
  c.fillStyle = '#1b2440'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  const lit = '#f3ecd0';
  c.fillStyle = lit; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill();
  const k = (1 - Math.cos(E * RAD)) / 2, rx = Math.max(0.01, r * Math.abs(Math.cos(E * RAD)));
  c.fillStyle = k > 0.5 ? lit : '#1b2440'; c.beginPath(); c.ellipse(0, 0, rx, r, 0, 0, TAU); c.fill();
  c.restore();
}
function drawMoonIcon(canvas, L) {
  const c = canvas.getContext('2d'), w = canvas.width; c.clearRect(0, 0, w, w);
  const E = moonE(L); drawMoonDisc(c, w / 2, w / 2, w * 0.38, E, E <= 180 ? 0 : Math.PI);
}
/* 별자리 미리보기 (남쪽 하늘에 떴을 때 모습: 위가 북, 왼쪽이 동) */
function conLocal(c) {
  const r0 = c.ra * RAD, d0 = c.dec * RAD;
  const E = [-Math.sin(r0), Math.cos(r0), 0], N = [-Math.sin(d0) * Math.cos(r0), -Math.sin(d0) * Math.sin(r0), Math.cos(d0)];
  let mx = 0.001;
  const pts = c.s.map(s => { const r = s.ra * RAD, d = s.dec * RAD, v = [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)]; const x = -(v[0] * E[0] + v[1] * E[1]), y = v[0] * N[0] + v[1] * N[1] + v[2] * N[2]; mx = Math.max(mx, Math.abs(x), Math.abs(y)); return { x, y, m: s.m, col: s.col }; });
  pts.forEach(p => { p.x /= mx; p.y /= mx; });
  return pts;
}
function drawThumb(canvas, c) {
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0a1230'); bg.addColorStop(1, '#162552');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const pts = conLocal(c), R = Math.min(w, h) * 0.38, X = p => w / 2 + p.x * R, Y = p => h / 2 - p.y * R;
  g.strokeStyle = 'rgba(160,190,255,.7)'; g.lineWidth = Math.max(1, w / 90);
  for (const ch of c.lines) { g.beginPath(); ch.forEach((i, n) => n ? g.lineTo(X(pts[i]), Y(pts[i])) : g.moveTo(X(pts[i]), Y(pts[i]))); g.stroke(); }
  for (const p of pts) { g.fillStyle = rgb(STARCOL[p.col] || STARCOL['']); g.beginPath(); g.arc(X(p), Y(p), (p.m === 1 ? 4.2 : p.m === 2 ? 3 : 2.2) * w / 120, 0, TAU); g.fill(); }
}

/* ───────── 하늘 장면 ───────── */
let SSTAR = null;                                    // 별똥별
function skyLayout(dt) {
  const ah = H - UI.top - UI.bot, aw = W - UI.right;
  let want = sky.wide ? Math.min(aw / 5, (ah - 46) / 1.8) : Math.min(Math.max(aw, ah * 1.25) / 2.35, (ah - 46) / 1.5);
  want = Math.max(want, 80);
  V.sc = dt ? lerp(V.sc, want, 1 - Math.exp(-dt * 6)) : want;
  V.cx = aw / 2;
  const cy = H - UI.bot - 46 - 0.3527 * V.sc;       // 기본 시선(고도 20°)에서 지평선이 화면 아래쪽에 오도록
  V.cy = dt ? lerp(V.cy, cy, 1 - Math.exp(-dt * 8)) : cy;
}
function drawSky(t, dt) {
  S.lst = lstOf(sky.doy, sky.hour);
  const se = sunEq(sky.doy); S.sun = altaz(se.ra, se.dec, S.lst);
  const me = ecl2eq(mod(sunLon(sky.doy) + moonE(sky.L), 360)); S.moon = altaz(me.ra, me.dec, S.lst);
  setView(); skyLayout(dt);
  const ecl = sky.ecl;
  let sunAlt = S.sun.alt, eclCov = 0, eclP = 0;
  if (ecl) { eclP = Math.min(1, ((performance.now() - ecl.t0) / 9000) % 1.25); if (ecl.kind === 'solar') { const off = lerp(2.5, -2.5, eclP); eclCov = clamp(1 - Math.abs(off) / 2, 0, 1); sunAlt = 40; } else sunAlt = -40; }
  // 배경
  const tw = clamp((sunAlt + 14) / 14, 0, 1), day = clamp(sunAlt / 9, 0, 1);
  let top = mix([3, 6, 24], [22, 34, 82], tw), bot = mix([12, 24, 58], [190, 110, 80], tw);
  top = mix(top, [44, 110, 196], day); bot = mix(bot, [160, 208, 240], day);
  if (eclCov) { const k = Math.pow(eclCov, 3); top = mix(top, [6, 8, 24], k); bot = mix(bot, [40, 38, 70], k); }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  S.sa = ecl ? (ecl.kind === 'solar' ? Math.pow(eclCov, 6) * 0.8 : 1) : clamp((-S.sun.alt - 3) / 7, 0, 1);
  const sa = S.sa;
  // 박명
  if (!ecl && S.sun.alt > -16 && S.sun.alt < 8) {
    const p = proj(S.sun.az, Math.max(S.sun.alt, -2));
    if (p) { const R = V.sc * 1.3, gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); const a = clamp(1 - Math.abs(S.sun.alt + 3) / 13, 0, 1) * 0.75; gg.addColorStop(0, 'rgba(255,170,90,' + a + ')'); gg.addColorStop(1, 'rgba(255,150,90,0)'); ctx.fillStyle = gg; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2); }
  }
  const scl = Math.sqrt(V.sc / 320);
  if (sa > 0.01) {
    // 배경 별
    for (const b of BG) {
      const q = altaz(b.ra, b.dec, S.lst); if (q.alt < -3) continue;
      const p = proj(q.az, q.alt); if (!p || p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5) continue;
      ctx.fillStyle = 'rgba(220,228,255,' + (sa * b.b * (0.75 + 0.25 * Math.sin(t * 2.2 + b.ph))) + ')';
      ctx.fillRect(p.x, p.y, b.sz * scl * 1.5, b.sz * scl * 1.5);
    }
    // 별자리
    if (!ecl) for (const c of CONS) {
      const P = c._p = c.s.map(s => { const q = altaz(s.ra, s.dec, S.lst); const p = proj(q.az, q.alt); return p ? { x: p.x, y: p.y, alt: q.alt } : null; });
      const q = altaz(c.ra, c.dec, S.lst); c._alt = q.alt; c._az = q.az; c._c = proj(q.az, q.alt);
      const hi = sky.hi === c.id;
      ctx.lineWidth = hi ? 2.4 : 1.1; ctx.lineJoin = 'round';
      ctx.strokeStyle = hi ? 'rgba(255,214,110,' + sa + ')' : 'rgba(140,172,240,' + (sky.hunt ? 0.5 : 0.36) * sa + ')';
      for (const ch of c.lines) {
        ctx.beginPath(); let pen = false;
        for (const i of ch) { const p = P[i]; if (!p) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; } }
        ctx.stroke();
      }
      c.s.forEach((s, i) => {
        const p = P[i]; if (!p) return;
        const col = STARCOL[s.col] || STARCOL[''], r = (s.m === 1 ? 3.3 : s.m === 2 ? 2.2 : 1.6) * scl, twk = 0.85 + 0.15 * Math.sin(t * 3 + i * 1.7 + c.ra);
        if (s.m === 1) { ctx.fillStyle = rgb(col, 0.22 * sa); ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, TAU); ctx.fill(); }
        if (s.col === 'p') { ctx.fillStyle = rgb(col, 0.8 * sa); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(p.x + Math.cos(k * 1.9) * 4.5 * scl, p.y + Math.sin(k * 2.7) * 4 * scl, 1.1 * scl, 0, TAU); ctx.fill(); } return; }
        ctx.fillStyle = rgb(col, sa * twk); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      });
    }
  }
  if (ecl || sa <= 0.01) for (const c of CONS) { c._p = null; c._c = null; }
  if (!ecl) {
    // 태양
    if (S.sun.alt > -1.5) {
      const p = proj(S.sun.az, S.sun.alt);
      if (p) { const r = clamp(V.sc * 0.04, 12, 28), gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5); gg.addColorStop(0, 'rgba(255,250,220,1)'); gg.addColorStop(0.2, 'rgba(255,235,150,.9)'); gg.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y, r * 5, 0, TAU); ctx.fill(); }
    }
    // 달
    const E = moonE(sky.L);
    if (!sky.hideMoon && S.moon.alt > -3 && E > 8 && E < 352) {
      const p = proj(S.moon.az, S.moon.alt);
      if (p) {
        const r = clamp(V.sc * 0.036, 10, 26), m = vecOf(S.moon.az, S.moon.alt), s = vecOf(S.sun.az, S.sun.alt);
        const d = m[0] * s[0] + m[1] * s[1] + m[2] * s[2], tx = s[0] - d * m[0], ty = s[1] - d * m[1], tz = s[2] - d * m[2];
        const q = projV(m[0] + tx * 0.05, m[1] + ty * 0.05, m[2] + tz * 0.05);
        const ang = q ? Math.atan2(q.y - p.y, q.x - p.x) : 0, k = (1 - Math.cos(E * RAD)) / 2;
        const gg = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r * 4.5); gg.addColorStop(0, 'rgba(240,235,200,' + 0.35 * k + ')'); gg.addColorStop(1, 'rgba(240,235,200,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4.5, 0, TAU); ctx.fill();
        drawMoonDisc(ctx, p.x, p.y, r, E, ang);
        S.moonP = { x: p.x, y: p.y, r };
      } else S.moonP = null;
    } else S.moonP = null;
    // 별똥별
    if (SSTAR) {
      const u = (performance.now() - SSTAR.t0) / SSTAR.dur;
      if (u >= 1) SSTAR = null; else {
        const hx = lerp(SSTAR.x0, SSTAR.x1, u), hy = lerp(SSTAR.y0, SSTAR.y1, u), tx2 = lerp(SSTAR.x0, SSTAR.x1, Math.max(0, u - 0.22)), ty2 = lerp(SSTAR.y0, SSTAR.y1, Math.max(0, u - 0.22));
        const lg = ctx.createLinearGradient(tx2, ty2, hx, hy); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(255,250,210,' + (SSTAR.hit ? 0.3 : 1) + ')');
        ctx.strokeStyle = lg; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 3.2, 0, TAU); ctx.fill(); SSTAR.hx = hx; SSTAR.hy = hy;
      }
    }
  } else drawEclipse(ecl, eclP);
  // 구름
  if (sky.cloud > 0.01) {
    const a = sky.cloud; ctx.fillStyle = 'rgba(22,28,48,' + 0.93 * a + ')'; ctx.fillRect(0, 0, W, H);
    for (const b of CLB) {
      const x = mod(b.x + t * b.v, 1.4) - 0.2, X = x * W, Y = b.y * H - (1 - a) * H * 0.3, R = b.r * Math.max(W, H) * 0.62;
      const gg = ctx.createRadialGradient(X, Y, 0, X, Y, R); gg.addColorStop(0, 'rgba(78,90,122,' + 0.5 * a + ')'); gg.addColorStop(1, 'rgba(78,90,122,0)');
      ctx.fillStyle = gg; ctx.fillRect(X - R, Y - R, R * 2, R * 2);
    }
  }
  // 예상 달 (달 예보 임무)
  if (sky.ghost && sky.ghost.zone && ZONE_AZ[sky.ghost.zone]) {
    const p = proj(ZONE_AZ[sky.ghost.zone] + (sky.ghost.zone === '동' ? 6 : sky.ghost.zone === '서' ? -6 : 0), 30);
    if (p) {
      const r = clamp(V.sc * 0.05, 14, 30);
      ctx.strokeStyle = 'rgba(255,214,110,.9)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7 + Math.sin(t * 4) * 1.5, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (sky.ghost.L) { const E = moonE(sky.ghost.L); drawMoonDisc(ctx, p.x, p.y, r, E, E <= 180 ? 0 : Math.PI, 0.92); }
      else { ctx.fillStyle = 'rgba(255,214,110,.9)'; ctx.font = 'bold ' + Math.round(r * 1.1) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', p.x, p.y + 1); }
    }
  }
  // 땅
  const pts = [];
  for (let a = -156; a <= 156; a += 1.5) { const az = sky.az + a; const p = proj(az, terrain(az)); if (p) pts.push(p); }
  if (pts.length > 2) {
    ctx.beginPath(); ctx.moveTo(Math.min(-50, pts[0].x), H + 60); ctx.lineTo(Math.min(-50, pts[0].x), pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    const lp = pts[pts.length - 1]; ctx.lineTo(Math.max(W + 50, lp.x), lp.y); ctx.lineTo(Math.max(W + 50, lp.x), H + 60); ctx.closePath();
    const gl = clamp(day * 0.9 + tw * 0.25, 0, 1) * (1 - Math.pow(eclCov, 3) * 0.8);
    ctx.fillStyle = rgb(mix([4, 6, 12], [34, 52, 44], gl)); ctx.fill();
    ctx.strokeStyle = 'rgba(130,150,200,.22)'; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  }
  // 방위
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const DN = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  for (let i = 0; i < 8; i++) {
    const p = proj(i * 45, -2.6); if (!p || p.x < -30 || p.x > W + 30) continue;
    const main = i % 2 === 0;
    ctx.font = (main ? 'bold ' + Math.round(clamp(19 * scl, 15, 24)) : Math.round(clamp(13 * scl, 11, 16))) + 'px ' + FONT;
    ctx.fillStyle = main ? '#f0cd78' : 'rgba(200,190,150,.7)';
    ctx.fillText(DN[i], p.x, Math.min(p.y + 10, H - UI.bot - 12));
  }
  // 이름표
  if (sa > 0.3 && sky.cloud < 0.5 && !ecl) {
    for (const c of CONS) {
      if (!c._c || c._alt < 2) continue; const hi = sky.hi === c.id; if (!hi && !sky.labels) continue;
      let ly = -200; if (c._p) for (const p of c._p) if (p && p.y > ly) ly = p.y;
      ctx.font = (hi ? 'bold ' + Math.round(17 * Math.max(1, scl)) : Math.round(12.5 * Math.max(1, scl))) + 'px ' + FONT;
      ctx.fillStyle = hi ? '#ffd76e' : 'rgba(196,212,255,.82)';
      ctx.fillText(c.full, c._c.x, ly + (hi ? 20 : 15));
    }
    if (sky.moonLabel && S.moonP) { ctx.font = 'bold 16px ' + FONT; ctx.fillStyle = '#ffd76e'; ctx.fillText(sky.moonLabel, S.moonP.x, S.moonP.y + S.moonP.r + 20); }
  }
}
function drawEclipse(ecl, p) {
  const ah = H - UI.top - UI.bot, aw = W - UI.right, cx = aw / 2, cy = UI.top + ah * 0.5, R = clamp(Math.min(aw, ah) * 0.11, 26, 84);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let cap = '';
  if (ecl.kind === 'solar') {
    const off = lerp(2.5, -2.5, p) * R, cov = clamp(1 - Math.abs(off) / (2 * R), 0, 1);
    const gg = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (cov > 0.97 ? 3.4 : 2.6)); gg.addColorStop(0, cov > 0.97 ? 'rgba(255,255,255,.95)' : 'rgba(255,240,170,.85)'); gg.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, R * 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.fillStyle = cov > 0 ? '#05060f' : 'rgba(20,30,60,.55)'; ctx.beginPath(); ctx.arc(cx + off, cy, R * 1.02, 0, TAU); ctx.fill();
    cap = cov <= 0 ? (p < 0.5 ? '달이 오른쪽(서쪽)에서 다가온다' : '일식 끝 — 해가 돌아왔다!') : cov > 0.97 ? '개기 일식!' : (p < 0.5 ? '부분 일식 — 태양의 오른쪽(서쪽)부터 가려진다' : '부분 일식 — 오른쪽(서쪽)부터 다시 드러난다');
  } else {
    const Ru = R * 2.7, off = lerp(1.25, -1.25, p) * (Ru + R);
    ctx.fillStyle = 'rgba(70,16,12,.4)'; ctx.beginPath(); ctx.arc(cx, cy, Ru, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,120,.45)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, Ru, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '13px ' + FONT; ctx.fillStyle = 'rgba(255,170,140,.8)'; ctx.fillText('지구의 본그림자', cx, cy - Ru - 12);
    const mx = cx + off;
    ctx.save(); ctx.beginPath(); ctx.arc(mx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#f3ecd0'; ctx.fillRect(mx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(120,34,20,.93)'; ctx.beginPath(); ctx.arc(cx, cy, Ru, 0, TAU); ctx.fill();
    ctx.restore();
    const d = Math.abs(off); cap = d >= Ru + R ? (p < 0.5 ? '달이 그림자 쪽으로 다가간다 (서→동)' : '월식 끝') : d <= Ru - R ? '개기 월식 — 붉은 달' : (p < 0.5 ? '부분 월식 — 달의 왼쪽(동쪽)부터 가려진다' : '부분 월식 — 왼쪽(동쪽)부터 다시 밝아진다');
  }
  ctx.font = 'bold ' + clamp(aw / 32, 15, 22) + 'px ' + FONT; ctx.fillStyle = '#ffe9a8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
  ctx.fillText(cap, cx, UI.top + 30);
  ctx.font = clamp(aw / 44, 12, 15) + 'px ' + FONT; ctx.fillStyle = 'rgba(230,230,255,.85)';
  ctx.fillText('← 동(왼쪽)　　　달이 움직이는 방향 ←　　　서(오른쪽) →', cx, UI.top + 56); ctx.shadowBlur = 0;
}

/* ───────── 혼천의 장면 ───────── */
let SPL = null;
const P2 = (c, R, deg) => ({ x: c.x + R * Math.cos(deg * RAD), y: c.y - R * Math.sin(deg * RAD) });
function spaceLayout() {
  const top = UI.top + 6, ah = H - top - UI.bot - 6, aw = W - UI.right; let s, c1, c2;
  if (!SP.d1 || !SP.d2) { s = Math.min(aw, ah); c1 = c2 = { x: aw / 2, y: top + ah / 2 }; }
  else if (aw > ah * 1.25) { s = Math.min(aw / 2, ah); c1 = { x: aw * 0.25, y: top + ah / 2 }; c2 = { x: aw * 0.75, y: top + ah / 2 }; }
  else { s = Math.min(aw, ah / 2); c1 = { x: aw / 2, y: top + ah * 0.25 }; c2 = { x: aw / 2, y: top + ah * 0.75 }; }
  return { s, c1, c2, Rz: s * 0.44, Ro: s * 0.26, Rm: s * 0.27, Re: s * 0.1, rw: s * 0.085 };
}
function band(c, Rin, Rout, a1, a2) { ctx.beginPath(); ctx.arc(c.x, c.y, Rout, -a2 * RAD, -a1 * RAD); ctx.arc(c.x, c.y, Rin, -a1 * RAD, -a2 * RAD, true); ctx.closePath(); }
function zodRing(c, L, hi) {
  const th = L.s * 0.08, fs = clamp(L.s * 0.037, 10.5, 17);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let k = 0; k < 12; k++) {
    band(c, L.Rz - th / 2, L.Rz + th / 2, ZC(k) - 15, ZC(k) + 15);
    ctx.fillStyle = hi === k ? 'rgba(255,205,90,.5)' : k % 2 ? 'rgba(70,95,170,.3)' : 'rgba(50,70,140,.3)'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,175,240,.35)'; ctx.lineWidth = 1; ctx.stroke();
    const p = P2(c, L.Rz, ZC(k));
    ctx.font = (hi === k ? 'bold ' : '') + fs + 'px ' + FONT; ctx.fillStyle = hi === k ? '#ffe08a' : 'rgba(215,225,255,.92)';
    ctx.fillText(CON[ZOD[k]].sh, p.x, p.y);
  }
}
function arrowHead(x, y, ang, sz) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - sz * Math.cos(ang - 0.45), y - sz * Math.sin(ang - 0.45)); ctx.lineTo(x - sz * Math.cos(ang + 0.45), y - sz * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill(); }
function drawSpace(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04081c'); g.addColorStop(1, '#0b1436'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const b = BG[i]; ctx.fillStyle = 'rgba(220,228,255,' + b.b * 0.5 + ')'; ctx.fillRect(mod(b.ra * 7.31, 1) * W, mod(b.dec * 3.17 + 90, 1) * H, 1.4, 1.4); }
  const L = SPL = spaceLayout(), s = L.s, ls = sunLon(T.doy), fs = clamp(s * 0.035, 10.5, 16), pulse = 1 + 0.18 * Math.sin(t * 5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (SP.d1) drawOrbit(L, ls, fs, pulse);
  if (SP.d2) drawDial(L, ls, fs, pulse, t);
}
function drawOrbit(L, ls, fs, pulse) {
  /* ① 공전 궤도 */
  const c1 = L.c1, s = L.s;
  zodRing(c1, L, SP.hiZ);
  ctx.font = 'bold ' + fs + 'px ' + FONT; ctx.fillStyle = 'rgba(255,224,150,.9)'; ctx.fillText('① 지구의 공전', c1.x, c1.y - s * 0.495 + 2);
  ctx.strokeStyle = 'rgba(160,190,255,.45)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c1.x, c1.y, L.Ro, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (SP.months || SP.snapE) for (let m = 1; m <= 12; m++) {
    const a = sunLon(doyOf(m, 1)) + 180, p = P2(c1, L.Ro, a);
    ctx.fillStyle = 'rgba(190,210,255,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, SP.snapE ? 4 : 2, 0, TAU); ctx.fill();
    if (SP.months) { const q = P2(c1, L.Ro + s * 0.05, a); ctx.font = fs * 0.9 + 'px ' + FONT; ctx.fillStyle = 'rgba(190,210,255,.85)'; ctx.fillText(m + '월', q.x, q.y); }
  }
  { const a0 = ls + 180 + 28, a1 = a0 + 26; ctx.strokeStyle = ctx.fillStyle = 'rgba(140,220,255,.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(c1.x, c1.y, L.Ro - s * 0.045, -a1 * RAD, -a0 * RAD); ctx.stroke(); const q = P2(c1, L.Ro - s * 0.045, a1); arrowHead(q.x, q.y, -(a1 + 90) * RAD, 8); }
  const sg = ctx.createRadialGradient(c1.x, c1.y, 0, c1.x, c1.y, s * 0.11); sg.addColorStop(0, '#fff8d8'); sg.addColorStop(0.35, '#ffd257'); sg.addColorStop(1, 'rgba(255,190,60,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(c1.x, c1.y, s * 0.11, 0, TAU); ctx.fill();
  ctx.font = 'bold ' + fs + 'px ' + FONT; ctx.fillStyle = '#5a3a00'; ctx.fillText('태양', c1.x, c1.y);
  const ep = P2(c1, L.Ro, ls + 180);
  if (SP.sunLine) { const q = P2(c1, L.Rz - s * 0.04, ls); ctx.strokeStyle = 'rgba(255,214,110,.75)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ep.x, ep.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,214,110,.9)'; arrowHead(q.x, q.y, -ls * RAD, 9); }
  if (SP.dragE) { ctx.strokeStyle = 'rgba(255,214,110,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ep.x, ep.y, s * 0.04 * pulse, 0, TAU); ctx.stroke(); }
  const er = Math.max(7, s * 0.026);
  ctx.fillStyle = '#12306b'; ctx.beginPath(); ctx.arc(ep.x, ep.y, er, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4b9bf0'; ctx.beginPath(); ctx.arc(ep.x, ep.y, er, -(ls + 90) * RAD, -(ls - 90) * RAD); ctx.closePath(); ctx.fill();
  ctx.font = fs * 0.9 + 'px ' + FONT; ctx.fillStyle = '#bfe0ff'; { const q = P2(c1, L.Ro - s * 0.06, ls + 180 - 14); ctx.fillText('지구', q.x, q.y); }
}
function drawDial(L, ls, fs, pulse, t) {
  /* ② 지구와 달 */
  const c2 = L.c2, s = L.s;
  zodRing(c2, L, SP.hiZ2);
  ctx.font = 'bold ' + fs + 'px ' + FONT; ctx.fillStyle = 'rgba(255,224,150,.9)'; ctx.fillText('② 지구에서 본 방향 (지구·달)', c2.x, c2.y - s * 0.495 + 2);
  // 햇빛
  { const sp = P2(c2, s * 0.37, ls); const gg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, s * 0.05); gg.addColorStop(0, '#fff8d8'); gg.addColorStop(0.4, '#ffd257'); gg.addColorStop(1, 'rgba(255,190,60,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sp.x, sp.y, s * 0.05, 0, TAU); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle = 'rgba(255,220,120,.5)'; ctx.lineWidth = 1.3;
    for (const o of [-0.17, 0, 0.17]) { const px = -Math.sin(ls * RAD) * o * s, py = -Math.cos(ls * RAD) * o * s, a = P2(c2, s * 0.33, ls), b = P2(c2, o ? s * 0.2 : s * 0.3, ls); ctx.beginPath(); ctx.moveTo(a.x + px, a.y + py); ctx.lineTo(b.x + px, b.y + py); ctx.stroke(); arrowHead(b.x + px, b.y + py, Math.atan2(b.y - a.y, b.x - a.x), 7); }
    const lp = P2(c2, s * 0.37, ls - 15); ctx.font = fs * 0.85 + 'px ' + FONT; ctx.fillStyle = 'rgba(255,224,150,.85)'; ctx.fillText('햇빛', lp.x, lp.y); }
  if (SP.moon) {
    ctx.strokeStyle = 'rgba(200,205,225,.35)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c2.x, c2.y, L.Rm, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (SP.snapM) for (let k = 0; k < 8; k++) { const p = P2(c2, L.Rm, ls + k * 45); ctx.strokeStyle = 'rgba(255,214,110,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.042, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  // 지구
  ctx.fillStyle = '#0e2553'; ctx.beginPath(); ctx.arc(c2.x, c2.y, L.Re, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3f8fe8'; ctx.beginPath(); ctx.arc(c2.x, c2.y, L.Re, -(ls + 90) * RAD, -(ls - 90) * RAD); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c2.x, c2.y, L.Re, 0, TAU); ctx.stroke();
  { ctx.strokeStyle = ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; const a0 = t * 20 % 360, a1 = a0 + 250; ctx.beginPath(); ctx.arc(c2.x, c2.y, L.Re * 0.5, -a1 * RAD, -a0 * RAD); ctx.stroke(); const q = P2(c2, L.Re * 0.5, a1); arrowHead(q.x, q.y, -(a1 + 90) * RAD, 6); ctx.font = fs * 0.8 + 'px ' + FONT; ctx.fillText('자전', c2.x, c2.y); }
  // 관측자
  if (SP.obs) {
    const a = ls + (T.hour - 12) * 15, op = P2(c2, L.Re, a), rw = L.rw;
    ctx.fillStyle = 'rgba(255,230,150,.17)'; ctx.strokeStyle = 'rgba(255,230,150,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(op.x, op.y); ctx.arc(op.x, op.y, rw, -(a + 90) * RAD, -(a - 90) * RAD); ctx.closePath(); ctx.fill(); ctx.stroke();
    const q = P2(c2, L.Rz - s * 0.04, a); ctx.strokeStyle = 'rgba(255,240,180,.8)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(op.x, op.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,240,180,.9)'; arrowHead(q.x, q.y, -a * RAD, 8);
    ctx.font = 'bold ' + fs + 'px ' + FONT; ctx.fillStyle = '#ffe08a';
    const pe = P2(op, rw + fs * 0.9, a + 90), pw = P2(op, rw + fs * 0.9, a - 90), ps = P2(op, rw + fs * 0.95, a + 16);
    ctx.fillText('동', pe.x, pe.y); ctx.fillText('서', pw.x, pw.y); ctx.fillText('남', ps.x, ps.y);
    if (SP.dragO) { ctx.strokeStyle = 'rgba(255,214,110,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(op.x, op.y, 9 * pulse, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#ffd257'; ctx.beginPath(); ctx.arc(op.x, op.y, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1; ctx.stroke();
  }
  // 달
  if (SP.moon) {
    const am = ls + moonE(T.L), mp = P2(c2, L.Rm, am), mr = s * 0.036;
    if (SP.dragM) { ctx.strokeStyle = 'rgba(255,214,110,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mp.x, mp.y, mr * 1.5 * pulse, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#2a2f45'; ctx.beginPath(); ctx.arc(mp.x, mp.y, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f3ecd0'; ctx.beginPath(); ctx.arc(mp.x, mp.y, mr, -(ls + 90) * RAD, -(ls - 90) * RAD); ctx.closePath(); ctx.fill();
    ctx.font = fs * 0.85 + 'px ' + FONT; ctx.fillStyle = 'rgba(235,235,255,.85)'; const q = P2(c2, L.Rm + mr + fs * 0.9, am); ctx.fillText('달', q.x, q.y);
    { const a0 = am + 14, a1 = a0 + 22; ctx.strokeStyle = ctx.fillStyle = 'rgba(220,220,240,.55)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(c2.x, c2.y, L.Rm, -a1 * RAD, -a0 * RAD); ctx.stroke(); const h = P2(c2, L.Rm, a1); arrowHead(h.x, h.y, -(a1 + 90) * RAD, 6); }
  }
}
/* 혼천의 조작 */
function spacePick(x, y) {
  const L = SPL; if (!L) return null;
  const d2 = Math.hypot(x - L.c2.x, y - L.c2.y), d1 = Math.hypot(x - L.c1.x, y - L.c1.y);
  if (SP.d2) {
    if (SP.dragO && d2 < L.Re + L.rw * 0.75) return 'obs';
    if (SP.dragM && Math.abs(d2 - L.Rm) < L.s * 0.085) return 'moon';
    if (SP.dragO && d2 < L.Rm) return 'obs';
  }
  if (SP.d1 && SP.dragE && Math.abs(d1 - L.Ro) < L.s * 0.11) return 'earth';
  return null;
}
function spaceDrag(mode, x, y) {
  const L = SPL; if (!L) return;
  if (mode === 'earth') {
    const a = Math.atan2(-(y - L.c1.y), x - L.c1.x) / RAD; let doy = lonToDoy(a - 180);
    if (SP.snapE) { let best = 1, bd = 1e9; for (let m = 1; m <= 12; m++) { const d = Math.abs(angDiff(sunLon(doyOf(m, 1)), a - 180)); if (d < bd) { bd = d; best = m; } } doy = doyOf(best, 1); }
    if (doy !== T.doy) { T.doy = doy; return true; }
  } else {
    const a = Math.atan2(-(y - L.c2.y), x - L.c2.x) / RAD, ls = sunLon(T.doy);
    if (mode === 'moon') {
      let E = mod(a - ls, 360); if (SP.snapM) E = mod(Math.round(E / 45) * 45, 360);
      let Ln = 1 + E * 14 / 180; if (!SP.snapM) Ln = Math.round(Ln * 2) / 2; if (Ln >= 29.5) Ln = 1;
      if (Ln !== T.L) { T.L = Ln; return true; }
    } else {
      const h = mod(Math.round(12 + angDiff(a, ls) / 15), 24);
      if (h !== T.hour) { T.hour = h; return true; }
    }
  }
  return false;
}
