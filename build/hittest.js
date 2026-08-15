// 命中判定稽核：對「當前頁面上每一張地圖的每一個目標」，算出它在螢幕上的實際座標，
// 用 document.elementFromPoint 檢查那個位置真的會命中它。
//
// 為什麼不用 dispatchEvent(new MouseEvent('click'))：那會直接命中你指定的元素，
// 完全繞過真實游標的命中判定與事件路徑 —— 所有這類 bug 都藏在那裡。
// elementFromPoint 走的是瀏覽器真正的命中堆疊（pointer-events、疊放順序、遮擋都算數）。
//
// 用法：window.__hit()
window.__hit = function () {
  const out = [];
  document.querySelectorAll('.mapbox').forEach((box, mi) => {
    const svg = box.querySelector('svg');
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / vb[2], r.height / vb[3]);
    const offX = r.left + (r.width - vb[2] * scale) / 2;
    const offY = r.top + (r.height - vb[3] * scale) / 2;
    const toScreen = (ux, uy) => [Math.round(offX + (ux - vb[0]) * scale), Math.round(offY + (uy - vb[1]) * scale)];

    let ok = 0, bad = [];
    // 每個地點的透明點擊圓
    svg.querySelectorAll('circle.hit').forEach(c => {
      const want = c.getAttribute('data-info');
      const [x, y] = toScreen(+c.getAttribute('cx'), +c.getAttribute('cy'));
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { bad.push(`${want} 在視窗外(捲動問題)`); return; }
      const el = document.elementFromPoint(x, y);
      const got = el && el.closest ? el.closest('[data-info]') : null;
      if (got && got.getAttribute('data-info') === want) ok++;
      else bad.push(`${want}@${x},${y} → ${got ? got.getAttribute('data-info') : (el ? el.className.baseVal || el.tagName : 'null')}`);
    });
    // 每塊疆域：在它的 bbox 上灑格點，只要有一點打得到就算過。
    // 不能只試 bbox 中心 —— 疆域被 clipPath 夾成只剩陸地那一塊，
    // 中心很可能落在被夾掉的海上，那裡本來就不該有東西。
    svg.querySelectorAll('path.rgn').forEach(p => {
      const want = p.getAttribute('data-info');
      const bb = p.getBBox();
      let hit = 0, tried = 0;
      for (let i = 1; i <= 7; i++) for (let j = 1; j <= 7; j++) {
        const [x, y] = toScreen(bb.x + bb.width * i / 8, bb.y + bb.height * j / 8);
        if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue;
        tried++;
        const el = document.elementFromPoint(x, y);
        const got = el && el.closest ? el.closest('[data-info]') : null;
        if (got) hit++;
      }
      if (!tried) bad.push(`疆域 ${want} 完全在視窗外`);
      else if (!hit) bad.push(`疆域 ${want} 灑 ${tried} 點全部打不到`);
      else ok++;
    });
    out.push({ map: mi, ok, bad });
  });
  return out;
};
