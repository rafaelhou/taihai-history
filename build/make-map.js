// 把 Natural Earth 10m 陸地圖資裁成本站需要的兩個視域，輸出 Mercator 投影的 SVG path
//   taihai — 台海語系分布區（浙南蒼南 → 泉漳潮汕 → 雷州半島、海南、台灣）
//   asia   — 真諦法師航路用的南亞～東亞大範圍圖
// 輸出 ../map-data.js  →  window.GEO = { taihai:{...}, asia:{...} }
//
// 疆域（八閩、三邑同安安溪、鄭氏勢力…）不在圖資裡，是手繪的，見 ../data/regions.js。
// 前端用這裡的 land path 當 <clipPath>，讓手繪疆域的海岸邊自動貼齊真實海岸線。
const fs = require('fs');
const path = require('path');

const SRC_LAND = path.join(__dirname, 'ne_10m_land.geojson');
const SRC_ISLE = path.join(__dirname, 'ne_10m_minor_islands.geojson');
const OUT = path.join(__dirname, '..', 'map-data.js');

// ── 視域定義 ───────────────────────────────────────────────
// tol：Douglas–Peucker 容差（度）。minArea：投影後小於此面積的環直接丟掉。
const VIEWS = {
  // 北界拉到 34°N，是為了讓「閩越人迫遷江淮」「開閩三王自光州南奔」「真諦法師到建康」
  // 這幾條線的起點終點都能落在同一張底圖上。
  // 西界拉到 103°E，是為了潮國那一章的「秦五路南侵百越」——西甌在廣西、駱越在越南北部，
  // 原本 107°E 的西界會把這兩個切掉。各章再用 viewBox 取自己要的那一塊。
  taihai: { lon0: 103.0, lon1: 123.6, lat0: 17.0,  lat1: 34.0,  w: 1400, tol: 0.0035,  minArea: 0.15 },
  asia:   { lon0: 66.0,  lon1: 133.0, lat0: -6.0,  lat1: 43.0,  w: 1200, tol: 0.06,    minArea: 1.5 },
  // 台北盆地：頂下郊拚用。這個尺度下圖資只剩淡水河口與北海岸，
  // 河道、沼澤是另外手繪的（見 data/maps.js），因為 Natural Earth 沒有河流面。
  taipei: { lon0: 121.26, lon1: 121.70, lat0: 24.94, lat1: 25.26, w: 1200, tol: 0.0006, minArea: 0.05 },
};

// ── Mercator ──────────────────────────────────────────────
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));

function makeProj(v) {
  const R = v.w / (((v.lon1 - v.lon0) * Math.PI) / 180);
  const y1 = mercY(v.lat1);
  const h = R * (y1 - mercY(v.lat0));
  return {
    R, y1, lon0: v.lon0,
    h,
    project: (lon, lat) => [(R * (lon - v.lon0) * Math.PI) / 180, R * (y1 - mercY(lat))],
  };
}

// ── Sutherland–Hodgman：把環裁到經緯度矩形內 ─────────────────
// 裁切在「度」的空間做，比投影後再裁單純，而且容差也是用度定義的。
function clipRing(pts, box) {
  const [x0, y0, x1, y1] = box; // lon0, lat0, lon1, lat1
  const edges = [
    { inside: p => p[0] >= x0, cut: (a, b) => [x0, lerp(a[1], b[1], (x0 - a[0]) / (b[0] - a[0]))] },
    { inside: p => p[0] <= x1, cut: (a, b) => [x1, lerp(a[1], b[1], (x1 - a[0]) / (b[0] - a[0]))] },
    { inside: p => p[1] >= y0, cut: (a, b) => [lerp(a[0], b[0], (y0 - a[1]) / (b[1] - a[1])), y0] },
    { inside: p => p[1] <= y1, cut: (a, b) => [lerp(a[0], b[0], (y1 - a[1]) / (b[1] - a[1])), y1] },
  ];
  let cur = pts;
  for (const e of edges) {
    const next = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[(i + cur.length - 1) % cur.length];
      const b = cur[i];
      const ia = e.inside(a), ib = e.inside(b);
      if (ib) {
        if (!ia) next.push(e.cut(a, b));
        next.push(b);
      } else if (ia) {
        next.push(e.cut(a, b));
      }
    }
    cur = next;
    if (!cur.length) return null;
  }
  return cur;
}

const lerp = (a, b, t) => a + (b - a) * t;

// ── Douglas–Peucker ───────────────────────────────────────
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j - i < 2) continue;
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const dx = bx - ax, dy = by - ay;
    const L = Math.hypot(dx, dy);
    let far = -1, farD = -1;
    for (let k = i + 1; k < j; k++) {
      const [px, py] = pts[k];
      const d = L === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * px - dx * py + bx * ay - by * ax) / L;
      if (d > farD) { farD = d; far = k; }
    }
    if (farD > tol) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// ── 主流程 ────────────────────────────────────────────────
function ringsOf(geojson) {
  const out = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) out.push(ring);
  }
  return out;
}

const land = ringsOf(JSON.parse(fs.readFileSync(SRC_LAND, 'utf8')));
const isles = ringsOf(JSON.parse(fs.readFileSync(SRC_ISLE, 'utf8')));
const ALL = land.concat(isles);
console.log(`原始環：陸地 ${land.length} + 小島 ${isles.length}`);

const r1 = n => Math.round(n * 10) / 10;

function shoelace(pts) {
  let A = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(A / 2);
}

const result = {};

for (const [key, v] of Object.entries(VIEWS)) {
  const pr = makeProj(v);
  const box = [v.lon0, v.lat0, v.lon1, v.lat1];
  const parts = [];
  let kept = 0, dropped = 0;

  for (const ring of ALL) {
    // 先用外框快篩，省下大量裁切
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const [lon, lat] of ring) {
      if (lon < mnx) mnx = lon; if (lon > mxx) mxx = lon;
      if (lat < mny) mny = lat; if (lat > mxy) mxy = lat;
    }
    if (mxx < v.lon0 || mnx > v.lon1 || mxy < v.lat0 || mny > v.lat1) continue;

    const clipped = clipRing(ring, box);
    if (!clipped || clipped.length < 3) continue;

    const simp = simplify(clipped, v.tol);
    if (simp.length < 3) continue;

    const pts = simp.map(([lon, lat]) => pr.project(lon, lat));
    if (shoelace(pts) < v.minArea) { dropped++; continue; }

    kept++;
    parts.push('M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z');
  }

  result[key] = {
    w: v.w,
    h: Math.round(pr.h),
    lon0: v.lon0, lat0: v.lat0, lon1: v.lon1, lat1: v.lat1,
    // 前端拿這三個值把 lon/lat 換成 SVG 座標
    R: Math.round(pr.R * 1e4) / 1e4,
    y1: Math.round(pr.y1 * 1e8) / 1e8,
    land: parts.join(''),
  };
  console.log(`${key}: viewBox 0 0 ${v.w} ${result[key].h}，保留 ${kept} 環、濾掉 ${dropped} 個碎島`);
}

fs.writeFileSync(OUT, 'window.GEO = ' + JSON.stringify(result) + ';\n', 'utf8');
console.log(`輸出 ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB → ${OUT}`);

// 抽樣檢查幾個關鍵地點落在哪
const pr = makeProj(VIEWS.taihai);
for (const [name, lon, lat] of [
  ['泉州', 118.68, 24.87], ['漳州', 117.65, 24.51], ['廈門', 118.09, 24.48],
  ['福州', 119.30, 26.08], ['台南鹿耳門', 120.10, 23.05], ['蒼南', 120.40, 27.51],
  ['海口', 110.20, 20.04],
]) {
  const [x, y] = pr.project(lon, lat);
  console.log(`  ${name} → ${r1(x)}, ${r1(y)}`);
}
