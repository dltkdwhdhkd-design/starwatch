'use strict';
/* 별지기 · STARWATCH — 천문 계산 (관측지: 한양, 북위 37.5°)
   - 태양: 황경이 하루 약 1°씩 증가 (춘분 3/21 = 0°)
   - 별: 실제 적경·적위 좌표
   - 달: 음력 날짜 → 태양과의 이각 (1일=삭, 8일=상현, 15일=망, 22일=하현)
   - 시각: 태양시 (정오에 태양 남중)                                            */
const RAD = Math.PI / 180, TAU = Math.PI * 2;
const $ = s => document.querySelector(s);
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => mod(a - b + 180, 360) - 180;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function RNG(seed) {
  const f = mulberry32(seed);
  return {
    f,
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    pick: arr => arr[Math.floor(f() * arr.length)],
    chance: p => f() < p,
    shuffle: arr => { arr = arr.slice(); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  };
}

const EPS = 23.44 * RAD, LAT = 37.5 * RAD, SL = Math.sin(LAT), CL = Math.cos(LAT);
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function doyOf(m, d) { let n = d; for (let i = 0; i < m - 1; i++) n += MDAYS[i]; return n; }
function mdOf(doy) { doy = mod(Math.round(doy) - 1, 365) + 1; let m = 0; while (doy > MDAYS[m]) { doy -= MDAYS[m]; m++; } return { m: m + 1, d: doy }; }
function sunLon(doy) { return mod((doy - 80) * 360 / 365.25, 360); }
function lonToDoy(lon) { return mod(Math.round(80 + mod(lon, 360) * 365.25 / 360) - 1, 365) + 1; }
function ecl2eq(lon, lat) {
  const l = lon * RAD, b = (lat || 0) * RAD;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(b) * Math.sin(l) * Math.cos(EPS) - Math.sin(b) * Math.sin(EPS);
  const z = Math.cos(b) * Math.sin(l) * Math.sin(EPS) + Math.sin(b) * Math.cos(EPS);
  return { ra: mod(Math.atan2(y, x) / RAD, 360), dec: Math.asin(clamp(z, -1, 1)) / RAD };
}
function sunEq(doy) { return ecl2eq(sunLon(doy)); }
function lstOf(doy, hour) { return mod(sunEq(doy).ra + (hour - 12) * 15, 360); }
function altaz(ra, dec, lst) {
  const Hh = (lst - ra) * RAD, d = dec * RAD;
  const sa = SL * Math.sin(d) + CL * Math.cos(d) * Math.cos(Hh);
  const y = -Math.cos(d) * Math.sin(Hh), x = Math.sin(d) * CL - Math.cos(d) * SL * Math.cos(Hh);
  return { alt: Math.asin(clamp(sa, -1, 1)) / RAD, az: mod(Math.atan2(y, x) / RAD, 360) };
}
function sunAltAz(doy, hour) { const e = sunEq(doy); return altaz(e.ra, e.dec, lstOf(doy, hour)); }
function moonE(L) { return mod((L - 1) * 180 / 14, 360); }       // 음력 날짜 → 이각
function moonAltAz(doy, hour, L) { const e = ecl2eq(mod(sunLon(doy) + moonE(L), 360)); return altaz(e.ra, e.dec, lstOf(doy, hour)); }

/* 별자리: [적경(시), 적위(°), 밝기등급(1 밝음~3), 색] */
const CONS = [
  { id: 'psc', ko: '물고기자리', sh: '물고기', season: '가을', note: '끈으로 묶인 두 마리 물고기. 4월 초에 태양이 이 별자리 앞을 지난다.',
    stars: [[23.29, 3.28, 3], [23.45, 1.26, 3], [23.70, 1.78, 3], [23.67, 5.63, 3], [23.47, 6.38, 3], [23.99, 6.86, 3], [0.81, 7.59, 3], [1.05, 7.89, 3], [1.69, 5.49, 3], [2.03, 2.76, 2], [1.76, 9.16, 3], [1.52, 15.35, 2], [1.23, 24.58, 3], [1.19, 30.09, 3]],
    lines: [[0, 1, 2, 3, 4, 0], [3, 5, 6, 7, 8, 9, 10, 11, 12, 13]] },
  { id: 'ari', ko: '양자리', sh: '양', season: '가을', note: '작은 갈고리 모양. 5월 초에 태양이 지난다.',
    stars: [[2.83, 27.26, 3], [2.12, 23.46, 2], [1.91, 20.81, 2], [1.89, 19.29, 3]], lines: [[0, 1, 2, 3]] },
  { id: 'tau', ko: '황소자리', sh: '황소', season: '겨울', note: '붉은 눈 알데바란과 V자 뿔, 그리고 좀생이별(플레이아데스).',
    stars: [[4.60, 16.51, 1, 'o'], [5.44, 28.61, 2], [5.63, 21.14, 3], [4.48, 19.18, 3], [4.38, 17.54, 3], [4.33, 15.63, 3], [4.01, 12.49, 3], [3.79, 24.11, 2, 'p']],
    lines: [[2, 0, 5, 6], [1, 3, 4, 5]] },
  { id: 'gem', ko: '쌍둥이자리', sh: '쌍둥이', season: '겨울', note: '나란히 빛나는 두 별 카스토르와 폴룩스.',
    stars: [[7.58, 31.89, 2], [7.76, 28.03, 1, 'y'], [6.73, 25.13, 3], [6.38, 22.51, 3], [6.25, 22.51, 3], [7.34, 21.98, 3], [7.07, 20.57, 3], [6.63, 16.40, 2]],
    lines: [[0, 2, 3, 4], [1, 5, 6, 7], [0, 1]] },
  { id: 'cnc', ko: '게자리', sh: '게', season: '봄', note: '쌍둥이자리와 사자자리 사이의 희미한 Y자.',
    stars: [[8.78, 28.76, 3], [8.72, 21.47, 3], [8.74, 18.15, 3], [8.28, 9.19, 3], [8.97, 11.86, 3]], lines: [[0, 1, 2, 3], [2, 4]] },
  { id: 'leo', ko: '사자자리', sh: '사자', season: '봄', note: '물음표를 뒤집은 듯한 사자 머리와 1등성 레굴루스.',
    stars: [[10.14, 11.97, 1, 'b'], [10.12, 16.76, 3], [10.33, 19.84, 2], [10.28, 23.42, 3], [9.88, 26.01, 3], [9.76, 23.77, 3], [11.24, 20.52, 2], [11.24, 15.43, 3], [11.82, 14.57, 2]],
    lines: [[0, 1, 2, 3, 4, 5], [2, 6, 8, 7, 0], [6, 7]] },
  { id: 'vir', ko: '처녀자리', sh: '처녀', season: '봄', note: '청백색 1등성 스피카가 빛나는 봄 별자리.',
    stars: [[13.42, -11.16, 1, 'b'], [12.69, -1.45, 2], [12.33, -0.67, 3], [11.84, 1.76, 3], [12.93, 3.40, 3], [13.04, 10.96, 2], [13.58, -0.60, 3]],
    lines: [[3, 2, 1, 0], [1, 4, 5], [4, 6, 0]] },
  { id: 'lib', ko: '천칭자리', sh: '천칭', season: '여름', note: '전갈자리 서쪽에 놓인 저울.',
    stars: [[14.85, -16.04, 2], [15.28, -9.38, 2], [15.59, -14.79, 3], [15.07, -25.28, 3]], lines: [[3, 0, 1, 2, 0]] },
  { id: 'sco', ko: '전갈자리', sh: '전갈', season: '여름', note: '붉은 심장 안타레스와 S자로 휘어진 꼬리. 여름 남쪽 하늘의 주인공.',
    stars: [[16.09, -19.81, 2], [16.01, -22.62, 2], [15.98, -26.11, 3], [16.35, -25.59, 3], [16.49, -26.43, 1, 'r'], [16.60, -28.22, 3], [16.84, -34.29, 2], [16.86, -38.05, 3], [16.90, -42.36, 3], [17.20, -43.24, 3], [17.62, -43.00, 2], [17.79, -40.13, 3], [17.71, -39.03, 2], [17.56, -37.10, 2]],
    lines: [[0, 1, 2], [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]] },
  { id: 'sgr', ko: '궁수자리', sh: '궁수', season: '여름', note: '주전자 모양. 우리은하 중심 방향이다.',
    stars: [[18.10, -30.42, 3], [18.35, -29.83, 2], [18.40, -34.38, 2], [18.47, -25.42, 3], [18.76, -26.99, 3], [18.92, -26.30, 2], [19.12, -27.67, 3], [19.04, -29.88, 2]],
    lines: [[0, 1, 3, 4, 5, 6, 7, 2, 0], [1, 2], [1, 4], [4, 7]] },
  { id: 'cap', ko: '염소자리', sh: '염소', season: '가을', note: '뒤집힌 삼각형 모양의 별자리.',
    stars: [[20.30, -12.54, 3], [20.35, -14.78, 2], [20.77, -25.27, 3], [20.86, -26.92, 3], [21.44, -22.41, 3], [21.67, -16.66, 3], [21.78, -16.13, 2], [21.37, -16.83, 3], [21.10, -17.23, 3]],
    lines: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 0]] },
  { id: 'aqr', ko: '물병자리', sh: '물병', season: '가을', note: '물병에서 물이 흘러내리는 모습. 3월 초에 태양이 지난다.',
    stars: [[20.79, -9.50, 3], [21.53, -5.57, 2], [22.10, -0.32, 2], [22.36, -1.39, 3], [22.48, -0.02, 3], [22.59, -0.12, 3], [22.42, 1.38, 3], [22.28, -7.78, 3], [22.88, -7.58, 3], [22.91, -15.82, 2]],
    lines: [[0, 1, 2, 3, 4, 5], [4, 6], [2, 7, 8, 9]] },
  { id: 'ori', ko: '오리온자리', sh: '오리온', season: '겨울', note: '나란한 삼태성과 붉은 베텔게우스, 푸른 리겔. 겨울 밤하늘의 왕.',
    stars: [[5.92, 7.41, 1, 'r'], [5.42, 6.35, 2], [5.59, 9.93, 3], [5.68, -1.94, 2], [5.60, -1.20, 2], [5.53, -0.30, 2], [5.80, -9.67, 2], [5.24, -8.20, 1, 'b']],
    lines: [[2, 0, 3, 6, 7, 5, 1, 2], [3, 4, 5]] },
  { id: 'cma', ko: '큰개자리', sh: '큰개', season: '겨울', note: '밤하늘에서 가장 밝은 별 시리우스가 있다.',
    stars: [[6.75, -16.72, 1, 'b'], [6.38, -17.96, 2], [7.14, -26.39, 2], [7.40, -29.30, 3], [6.98, -28.97, 2], [6.34, -30.06, 3]], lines: [[1, 0, 2, 3], [2, 4, 5]] },
  { id: 'uma', ko: '큰곰자리', full: '큰곰자리(북두칠성)', sh: '북두칠성', season: '봄', note: '국자 모양의 북두칠성. 국자 끝 두 별을 이어 5배 늘이면 북극성이다.',
    stars: [[11.06, 61.75, 2], [11.03, 56.38, 2], [11.90, 53.69, 2], [12.26, 57.03, 3], [12.90, 55.96, 2], [13.40, 54.93, 2], [13.79, 49.31, 2]], lines: [[0, 1, 2, 3, 0], [3, 4, 5, 6]] },
  { id: 'umi', ko: '작은곰자리', full: '작은곰자리(북극성)', sh: '북극성', season: '사계절', note: '꼬리 끝 별이 북극성. 거의 움직이지 않아 언제나 북쪽을 알려 준다.',
    stars: [[2.53, 89.26, 1, 'y'], [17.54, 86.59, 3], [16.77, 82.04, 3], [15.73, 77.79, 3], [14.85, 74.16, 2], [15.35, 71.83, 3], [16.29, 75.76, 3]], lines: [[0, 1, 2, 3, 4, 5, 6, 3]] },
  { id: 'cas', ko: '카시오페이아자리', sh: '카시오페이아', season: '가을', note: 'W자(또는 M자) 모양. 북두칠성 반대편에서 북극성을 찾게 해 준다.',
    stars: [[0.15, 59.15, 2], [0.68, 56.54, 2], [0.95, 60.72, 2], [1.43, 60.24, 2], [1.91, 63.67, 3]], lines: [[0, 1, 2, 3, 4]] },
  { id: 'cyg', ko: '백조자리', sh: '백조', season: '여름', note: '은하수 위를 나는 커다란 십자. 꼬리의 1등성 데네브.',
    stars: [[20.69, 45.28, 1], [20.37, 40.26, 2], [19.51, 27.96, 2], [20.77, 33.97, 2], [19.75, 45.13, 3]], lines: [[0, 1, 2], [4, 1, 3]] },
  { id: 'lyr', ko: '거문고자리', sh: '거문고', season: '여름', note: '직녀성 베가와 작은 평행사변형.',
    stars: [[18.62, 38.78, 1, 'b'], [18.75, 37.61, 3], [18.83, 33.36, 3], [18.98, 32.69, 3], [18.91, 36.90, 3]], lines: [[0, 1, 2, 3, 4, 1]] },
  { id: 'aql', ko: '독수리자리', sh: '독수리', season: '여름', note: '견우성 알타이르. 베가·데네브와 함께 여름철 대삼각형을 이룬다.',
    stars: [[19.85, 8.87, 1], [19.77, 10.61, 2], [19.92, 6.41, 3], [19.43, 3.11, 3], [19.09, 13.86, 3], [19.10, -4.88, 3], [20.19, -0.82, 3]], lines: [[1, 0, 2], [0, 3, 5], [4, 3, 6]] },
  { id: 'peg', ko: '페가수스자리', sh: '페가수스', season: '가을', note: '커다란 사각형(가을철 대사각형)이 표지.',
    stars: [[23.08, 15.21, 2], [23.06, 28.08, 2], [0.14, 29.09, 2], [0.22, 15.18, 2], [22.69, 10.83, 3], [22.17, 6.20, 3], [21.74, 9.88, 2], [22.72, 30.22, 3]], lines: [[0, 1, 2, 3, 0], [0, 4, 5, 6], [1, 7]] },
  { id: 'boo', ko: '목동자리', sh: '목동', season: '봄', note: '주황색 1등성 아르크투루스와 연 모양.',
    stars: [[14.26, 19.18, 1, 'o'], [14.75, 27.07, 2], [15.26, 33.31, 3], [15.03, 40.39, 3], [14.53, 38.31, 3], [14.53, 30.37, 3], [13.91, 18.40, 3]], lines: [[0, 1, 2, 3, 4, 5, 0], [0, 6]] }
];
const CON = {};
for (const c of CONS) {
  c.full = c.full || c.ko;
  c.s = c.stars.map(a => ({ ra: a[0] * 15, dec: a[1], m: a[2] || 2, col: a[3] || '' }));
  let x = 0, y = 0, z = 0;
  for (const s of c.s) { const r = s.ra * RAD, d = s.dec * RAD; x += Math.cos(d) * Math.cos(r); y += Math.cos(d) * Math.sin(r); z += Math.sin(d); }
  const n = Math.hypot(x, y, z);
  c.ra = mod(Math.atan2(y, x) / RAD, 360); c.dec = Math.asin(z / n) / RAD;
  CON[c.id] = c;
}
/* 황도 12궁: 교과서 그림처럼 '그 달 초에 태양이 지나는 별자리'
   4월 물고기 · 5월 양 · 6월 황소 · 7월 쌍둥이 · 8월 게 · 9월 사자
   10월 처녀 · 11월 천칭 · 12월 전갈 · 1월 궁수 · 2월 염소 · 3월 물병 */
const ZOD = ['psc', 'ari', 'tau', 'gem', 'cnc', 'leo', 'vir', 'lib', 'sco', 'sgr', 'cap', 'aqr'];
const ZC = k => 11 + 30 * k;                                   // 구역 중심 황경
const zodOfLon = lon => Math.floor(mod(lon - 11 + 15, 360) / 30);
const zodMonth = k => (k + 3) % 12 + 1;

function conView(c, doy, hour) {
  const lst = lstOf(doy, hour), p = altaz(c.ra, c.dec, lst);
  let mn = 90, mx = -90;
  for (const s of c.s) { const a = altaz(s.ra, s.dec, lst).alt; if (a < mn) mn = a; if (a > mx) mx = a; }
  return { alt: p.alt, az: p.az, minAlt: mn, maxAlt: mx };
}
const ZONE_AZ = { '동': 90, '남': 180, '서': 270 };
function dir8(az) { return ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(mod(az, 360) / 45) % 8]; }
function dateStr(doy) { const p = mdOf(doy); return p.m + '월 ' + p.d + '일'; }
function hourStr(h) {
  h = mod(Math.round(h), 24);
  if (h === 0) return '자정(0시)'; if (h === 12) return '정오';
  if (h < 7) return '새벽 ' + h + '시'; if (h < 12) return '아침 ' + h + '시';
  if (h < 18) return '낮 ' + (h - 12) + '시'; if (h < 21) return '저녁 ' + (h - 12) + '시';
  return '밤 ' + (h - 12) + '시';
}
const MOON_NAME = L => L <= 1.5 || L >= 29 ? '삭(안 보임)' : L < 6.5 ? '초승달' : L < 9.5 ? '상현달' : L < 13.5 ? '상현~보름 사이' : L < 16.5 ? '보름달' : L < 20.5 ? '보름~하현 사이' : L < 23.5 ? '하현달' : '그믐달';
const PHASES = [
  { L: 3, name: '초승달', tip: '초승달(오른쪽이 가늘게 빛나는 눈썹 모양)은 태양 바로 동쪽에 있어, 초저녁 서쪽 하늘에 잠깐 보였다가 곧 진다.' },
  { L: 8, name: '상현달', tip: '상현달(오른쪽 반달)은 태양보다 90° 동쪽에 있다. 정오쯤 떠서 해 질 무렵 남쪽 하늘에 있고, 자정 무렵 서쪽으로 진다.' },
  { L: 15, name: '보름달', tip: '보름달(망)은 태양 정반대편에 있다. 해 질 무렵 동쪽에서 떠서 자정에 남쪽 하늘에 오고, 해 뜰 무렵 서쪽으로 진다.' },
  { L: 22, name: '하현달', tip: '하현달(왼쪽 반달)은 자정 무렵 동쪽에서 떠서, 해 뜰 무렵 남쪽 하늘에 있다.' },
  { L: 27, name: '그믐달', tip: '그믐달(왼쪽이 가늘게 빛나는 눈썹 모양)은 새벽 동쪽 하늘에 잠깐 보이고 곧 해가 뜬다.' }
];
const phaseOf = L => PHASES.find(p => p.L === L);
function moonZone(doy, hour, L) {            // 달이 보이는 하늘: 동/남/서/none/null(애매)
  const p = moonAltAz(doy, hour, L);
  if (p.alt < -8) return 'none';
  if (p.alt < 8) return null;
  if (p.az >= 76 && p.az <= 123) return '동';
  if (p.az >= 147 && p.az <= 213) return '남';
  if (p.az >= 237 && p.az <= 284) return '서';
  return null;
}
