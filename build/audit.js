// 逐頁稽核：所有頁面、所有地圖、所有圖片、所有連結。
// 在瀏覽器 console 貼上執行；會自己走訪每一頁。回傳問題清單。
// 用法：await window.__audit()
window.__audit = async function () {
  const PAGES = ['index.html','ch1-minyue.html','ch2-nanchao.html','ch3-tang.html','ch4-wudai.html',
                 'ch5-songyuan.html','ch6-yisibaxi.html','ch7-zheng.html','ch8-duidu.html',
                 'ch9-minguo.html','sources.html'];
  const problems = [], stats = [];

  for (const page of PAGES) {
    const html = await (await fetch(page)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 內部連結是否存在
    for (const a of doc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const target = href.split('#')[0];
      if (!target) continue;
      const r = await fetch(target, { method: 'HEAD' });
      if (!r.ok) problems.push(`${page}: 連結壞掉 ${href}`);
    }

    // 宣告的地圖是否都有定義
    const maps = [...doc.querySelectorAll('[data-map]')].map(e => e.getAttribute('data-map'));
    for (const m of maps) if (!window.MAPS[m]) problems.push(`${page}: 地圖未定義 ${m}`);

    // 宣告的人物圖是否都有檔
    const ids = [];
    for (const e of doc.querySelectorAll('[data-people]'))
      ids.push(...e.getAttribute('data-people').split(',').map(s => s.trim()).filter(s => s && s[0] !== '!'));
    for (const e of doc.querySelectorAll('[data-fig]')) ids.push(e.getAttribute('data-fig'));
    for (const id of ids) {
      const c = window.CREDITS[id];
      if (!c) { problems.push(`${page}: 圖片 id 不存在 ${id}`); continue; }
      const r = await fetch('img/people/' + c.src, { method: 'HEAD' });
      if (!r.ok) problems.push(`${page}: 圖檔缺 img/people/${c.src}`);
    }

    stats.push(`${page}: ${maps.length} 圖 / ${ids.length} 人物圖 / ${doc.querySelectorAll('a[href]').length} 連結`);
  }

  // 每張地圖的內容完整性
  for (const [k, s] of Object.entries(window.MAPS)) {
    if (!window.GEO[s.view]) problems.push(`地圖 ${k}: view 不存在 ${s.view}`);
    const b = s.box, g = window.GEO[s.view];
    if (b[0] < g.lon0 || b[2] > g.lon1 || b[1] < g.lat0 || b[3] > g.lat1)
      problems.push(`地圖 ${k}: box 超出圖資範圍 ${JSON.stringify(b)} vs [${g.lon0},${g.lat0},${g.lon1},${g.lat1}]`);
    for (const p of s.places || []) {
      if (p.lon < b[0] || p.lon > b[2] || p.lat < b[1] || p.lat > b[3])
        problems.push(`地圖 ${k}: 地點「${p.name}」落在畫面外 (${p.lon},${p.lat})`);
    }
    for (const r of s.regions || []) {
      if (r.label && (r.label[0] < b[0] || r.label[0] > b[2] || r.label[1] < b[1] || r.label[1] > b[3]))
        problems.push(`地圖 ${k}: 疆域標籤「${r.name}」落在畫面外`);
    }
  }
  return { problems, stats };
};
