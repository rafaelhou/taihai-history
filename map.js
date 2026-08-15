/* ── 地圖元件 ───────────────────────────────────────────────
   底圖：build/make-map.js 由 Natural Earth 10m 生出的真實海岸線（window.GEO）
   疆域：data/*.js 手繪的經緯度多邊形，用 <clipPath> 夾住底圖陸地，
         所以疆域的海岸邊會自動貼齊真實海岸線，只有內陸邊界是示意的。

   刻意不做拖曳平移縮放 —— 改用「焦點」按鈕切 viewBox。
   之前在世界國旗那個站，拖曳配 setPointerCapture 把 click 的 target 重指向捕捉
   元素，害觸控裝置整個點不到，查了很久。這裡沒有拖曳就沒有那個問題。
   ────────────────────────────────────────────────────────── */
window.TH = window.TH || {};

(function () {
  let uid = 0;

  // lon/lat → SVG 使用者座標（Mercator，參數由 make-map.js 一起輸出）
  function projector(g) {
    return function (lon, lat) {
      return [
        g.R * (lon - g.lon0) * Math.PI / 180,
        g.R * (g.y1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))),
      ];
    };
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r1 = n => Math.round(n * 10) / 10;

  // 經緯度矩形 → viewBox 字串
  function boxToVB(pj, box) {
    const [a, b] = pj(box[0], box[3]);   // 左上（lat 大的在上）
    const [c, d] = pj(box[2], box[1]);   // 右下
    return { x: a, y: b, w: c - a, h: d - b };
  }

  function ringPath(pj, ring) {
    return 'M' + ring.map(p => { const q = pj(p[0], p[1]); return r1(q[0]) + ' ' + r1(q[1]); }).join('L') + 'Z';
  }
  function linePath(pj, pts) {
    return 'M' + pts.map(p => { const q = pj(p[0], p[1]); return r1(q[0]) + ' ' + r1(q[1]); }).join('L');
  }

  // 兩點之間拉一條弧線，用來畫航路——直線畫航海看起來太像鐵路
  function arcPath(pj, pts, bend) {
    if (pts.length !== 2) return linePath(pj, pts);
    const a = pj(pts[0][0], pts[0][1]), b = pj(pts[1][0], pts[1][1]);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const k = (bend === undefined ? 0.18 : bend);
    return `M${r1(a[0])} ${r1(a[1])}Q${r1(mx - dy * k)} ${r1(my + dx * k)} ${r1(b[0])} ${r1(b[1])}`;
  }

  const KIND = {
    city:   { r: 4.2, fill: 'var(--ink)',      ring: 'var(--paper)' },
    cap:    { r: 6.0, fill: 'var(--accent)',   ring: 'var(--paper)' },
    port:   { r: 5.0, fill: 'var(--accent-2)', ring: 'var(--paper)' },
    battle: { r: 5.2, fill: '#b8342a',         ring: '#ffe9c9' },
    temple: { r: 4.6, fill: 'var(--gold)',     ring: 'var(--paper)' },
    ghost:  { r: 3.6, fill: 'var(--ink-3)',    ring: 'var(--paper)' },
  };

  TH.renderMap = function (host, spec) {
    const g = window.GEO[spec.view];
    if (!g) { host.textContent = '（圖資未載入）'; return; }
    const pj = projector(g);
    const id = 'm' + (++uid);
    const vb = boxToVB(pj, spec.box);

    const P = [];  // 收集資訊卡內容
    const put = (key, html) => { P[key] = html; };

    let s = `<svg id="${id}-svg" viewBox="${r1(vb.x)} ${r1(vb.y)} ${r1(vb.w)} ${r1(vb.h)}" `
          + `preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(spec.alt || '歷史地圖')}">`
          + `<defs><clipPath id="${id}-land"><path d="${g.land}"/></clipPath></defs>`
          + `<rect x="${r1(vb.x)}" y="${r1(vb.y)}" width="${r1(vb.w)}" height="${r1(vb.h)}" fill="var(--sea)"/>`
          + `<path class="land" d="${g.land}" pointer-events="none"/>`;

    // ── 疆域 ──────────────────────────────────────────
    (spec.regions || []).forEach((rg, i) => {
      const key = 'r' + i;
      const d = ringPath(pj, rg.ring);
      const clip = rg.clip === false ? '' : ` clip-path="url(#${id}-land)"`;
      s += `<path class="rgn" data-info="${key}" d="${d}"${clip} fill="${rg.color}" `
         + `fill-opacity="${rg.op || .5}" stroke="${rg.color}" stroke-width="1.2" `
         + `vector-effect="non-scaling-stroke"><title>${esc(rg.name)}</title></path>`;
      put(key, `<b>${esc(rg.name)}</b>　${esc(rg.desc || '')}`);
    });

    // ── 航路／進軍路線 ────────────────────────────────
    (spec.routes || []).forEach((rt, i) => {
      const key = 't' + i;
      const d = rt.arc ? arcPath(pj, rt.pts, rt.bend) : linePath(pj, rt.pts);
      s += `<path class="route" data-info="${key}" d="${d}" stroke="${rt.color || 'var(--accent)'}" `
         + `stroke-width="${rt.w || 2.4}"${rt.dash ? ` stroke-dasharray="${rt.dash}"` : ''} `
         + `${rt.arrow === false ? '' : `marker-end="url(#${id}-ar)"`} opacity=".9"><title>${esc(rt.name)}</title></path>`;
      // 路線本身太細不好點，補一條透明粗線當點擊區
      s += `<path class="hit" data-info="${key}" d="${d}" stroke="transparent" stroke-width="14" fill="none"/>`;
      put(key, `<b>${esc(rt.name)}</b>　${esc(rt.desc || '')}`);
    });

    if ((spec.routes || []).some(r => r.arrow !== false)) {
      s = s.replace('</defs>',
        `<marker id="${id}-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" `
        + `orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>`);
    }

    // ── 疆域名稱 ──────────────────────────────────────
    (spec.regions || []).forEach(rg => {
      if (!rg.label) return;
      const [x, y] = pj(rg.label[0], rg.label[1]);
      s += `<text class="rlabel" x="${r1(x)}" y="${r1(y)}" text-anchor="middle" `
         + `fill="${rg.lc || rg.color}" stroke="var(--paper)" data-sz="${rg.ls || 20}">${esc(rg.short || rg.name)}</text>`;
    });

    // ── 地點 ──────────────────────────────────────────
    // 先算每個點到「最近的另一個點」的距離。點擊區在螢幕上固定大小，
    // 但像鹿耳門與熱蘭遮城只差 6 公里，圓一放大就會互相搶點擊 —— 後畫的那個永遠贏。
    // 所以下面用 nd 限制半徑，讓相鄰的點各自分到自己的地盤。
    const pxy = (spec.places || []).map(p => pj(p.lon, p.lat));
    const nd = pxy.map((a, i) => {
      let min = Infinity;
      pxy.forEach((b, j) => { if (i !== j) min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1])); });
      return min;
    });

    (spec.places || []).forEach((p, i) => {
      const key = 'p' + i;
      const k = KIND[p.kind] || KIND.city;
      const [x, y] = pxy[i];
      s += `<circle class="dot" cx="${r1(x)}" cy="${r1(y)}" data-r="${k.r}" fill="${k.fill}" `
         + `stroke="${k.ring}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      if (p.name) {
        const dx = p.la === 'l' ? -1 : p.la === 'c' ? 0 : 1;
        const anchor = dx < 0 ? 'end' : dx === 0 ? 'middle' : 'start';
        s += `<text class="plabel" x="${r1(x)}" y="${r1(y)}" data-dx="${dx}" data-dy="${p.la === 'c' ? -1 : 0}" `
           + `text-anchor="${anchor}" data-sz="${p.sz || 15}">${esc(p.name)}</text>`;
      }
      s += `<circle class="hit" data-info="${key}" cx="${r1(x)}" cy="${r1(y)}" `
         + `data-nd="${r1(isFinite(nd[i]) ? nd[i] : 9999)}"><title>${esc(p.name || '')}</title></circle>`;
      put(key, `<b>${esc(p.name || '')}</b>　${esc(p.desc || '')}`);
    });

    s += '</svg>';

    // ── 外框 ──────────────────────────────────────────
    const focus = spec.focus || [];
    const tools = focus.length
      ? `<div class="maptools"><span class="muted">焦點</span>`
        + focus.map((f, i) => `<button type="button" data-f="${i}" aria-pressed="${i === 0}">${esc(f.name)}</button>`).join('')
        + `</div>` : '';

    const legend = (spec.legend || []).length
      ? `<div class="legend">` + spec.legend.map(l =>
          l.line
            ? `<span><i class="ln" style="border-top-color:${l.c}${l.dash ? ';border-top-style:dashed' : ''}"></i>${esc(l.t)}</span>`
            : `<span><i style="background:${l.c}"></i>${esc(l.t)}</span>`
        ).join('') + `</div>` : '';

    host.innerHTML =
      `<div class="mapbox" id="${id}">${s}${tools}${legend}`
      + `<div class="mapinfo" id="${id}-info"><span class="ph">${esc(spec.hint || '點地圖上的疆域、路線或地點看說明')}</span></div></div>`
      + (spec.cap ? `<p class="mapcap">${spec.cap}</p>` : '');

    // ── 互動 ──────────────────────────────────────────
    const box = document.getElementById(id);
    const svg = document.getElementById(id + '-svg');
    const info = document.getElementById(id + '-info');

    box.addEventListener('click', e => {
      const t = e.target.closest('[data-info]');
      if (!t) return;
      const key = t.getAttribute('data-info');
      if (!P[key]) return;
      box.querySelectorAll('.rgn.on').forEach(n => n.classList.remove('on'));
      const rgn = box.querySelector('.rgn[data-info="' + key + '"]');
      if (rgn) rgn.classList.add('on');
      info.innerHTML = P[key];
    });

    let curVB = vb;
    if (focus.length) {
      box.querySelectorAll('.maptools button').forEach(b => {
        b.addEventListener('click', () => {
          box.querySelectorAll('.maptools button').forEach(o => o.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          curVB = boxToVB(pj, focus[+b.getAttribute('data-f')].box);
          svg.setAttribute('viewBox', `${r1(curVB.x)} ${r1(curVB.y)} ${r1(curVB.w)} ${r1(curVB.h)}`);
          sizeThings();
        });
      });
    }

    // 圓點、字級、點擊區在「螢幕上」要固定大小，所以得換算成使用者座標。
    // 兩個坑：
    //   1. 量 <svg> 的 clientWidth 拿到的是 SVG 使用者座標，不是 CSS 像素 —— 要用
    //      getBoundingClientRect()（回傳 CSS 像素），或量外層 div。
    //   2. CSS 給了 max-height，preserveAspectRatio="meet" 會左右留白，
    //      這時實際縮放比是「取寬高兩者較小的那個」，不能只看寬度。
    function sizeThings() {
      // 先依這張圖的長寬比限制卡片寬度，讓 SVG 剛好用滿、不留黑邊。
      // 只在值真的變了才寫，否則 ResizeObserver 會被自己觸發的尺寸變化反覆喚醒。
      const maxH = Math.max(280, Math.round(window.innerHeight * 0.74));
      const want = Math.round(curVB.w / curVB.h * maxH) + 'px';
      if (box.style.maxWidth !== want) { box.style.maxWidth = want; }

      const r = svg.getBoundingClientRect();
      const scale = Math.min((r.width || 320) / curVB.w, (r.height || 320) / curVB.h);
      const k = scale > 0 ? 1 / scale : curVB.w / 320;   // 1 CSS px = k 使用者座標
      svg.querySelectorAll('circle.dot').forEach(c => {
        c.setAttribute('r', r1(+c.getAttribute('data-r') * k));
      });
      svg.querySelectorAll('circle.hit').forEach(c => {
        // 目標 15 CSS px，但不得超過「與最近鄰點距離的 45%」，免得互搶點擊
        const lim = +c.getAttribute('data-nd') * 0.45;
        c.setAttribute('r', r1(Math.max(4 * k, Math.min(15 * k, lim))));
      });
      svg.querySelectorAll('text[data-sz]').forEach(t => {
        const sz = +t.getAttribute('data-sz') * k;
        t.setAttribute('font-size', r1(sz));
        if (t.classList.contains('plabel')) {
          const dx = +t.getAttribute('data-dx'), dy = +t.getAttribute('data-dy');
          t.setAttribute('dx', r1(dx * 7 * k));
          t.setAttribute('dy', r1(dy ? -8 * k : 5 * k));
          t.setAttribute('stroke-width', r1(3.5 * k));
        } else {
          t.setAttribute('stroke-width', r1(4 * k));
        }
      });
    }
    sizeThings();
    // 兩個都要：ResizeObserver 抓版面寬度變化，resize 抓「寬度沒變但視窗變矮」
    if (window.ResizeObserver) new ResizeObserver(sizeThings).observe(box);
    window.addEventListener('resize', sizeThings);
  };

  // 頁面上所有 <div data-map="鍵"> 自動套用 window.MAPS[鍵]
  TH.autoMaps = function () {
    document.querySelectorAll('[data-map]').forEach(el => {
      const spec = (window.MAPS || {})[el.getAttribute('data-map')];
      if (spec) TH.renderMap(el, spec);
      else el.innerHTML = '<p class="muted">（地圖 ' + esc(el.getAttribute('data-map')) + ' 未定義）</p>';
    });
  };
})();
