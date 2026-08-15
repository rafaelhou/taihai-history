/* ── 人物卡與圖片 ───────────────────────────────────────────
   用法：
     <div class="people" data-people="lienheng,koxinga"></div>
     <div class="people" data-people="koxinga,!真諦法師|印度勝征國僧人，558 年抵泉國"></div>
     <figure class="figure" data-fig="kaiyuan"></figure>

   id 對應 data/credits.js（由 build/get-images.ps1 抓圖時一併產生）。
   前面加 ! 的是「沒有可信圖像傳世」的人物，改畫一枚印記，並老實講沒有圖。
   ────────────────────────────────────────────────────────── */
window.TH = window.TH || {};

(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 沒有圖像的人物用這枚印記代替。刻意做得像鈐印，不要假裝是肖像。
  function seal(text) {
    const ch = [...String(text)].slice(0, 2).join('');
    return '<svg viewBox="0 0 100 133" aria-hidden="true" style="width:100%;aspect-ratio:3/4;display:block;background:var(--paper-2)">'
      + '<rect x="26" y="40" width="48" height="48" rx="4" fill="none" stroke="var(--accent)" stroke-width="3"/>'
      + '<text x="50" y="65" text-anchor="middle" font-size="19" fill="var(--accent)" '
      + 'font-family="Noto Serif TC, serif" font-weight="700">' + esc(ch) + '</text>'
      + '<text x="50" y="110" text-anchor="middle" font-size="8.5" fill="var(--ink-3)" '
      + 'font-family="Noto Sans TC, sans-serif">無圖像傳世</text></svg>';
  }

  function card(token) {
    if (token.charAt(0) === '!') {
      const [name, cap] = token.slice(1).split('|');
      return '<figure class="person">' + seal(name)
        + '<figcaption><div class="pn">' + esc(name) + '</div>'
        + '<div class="pc">' + esc(cap || '') + '</div></figcaption></figure>';
    }
    const c = (window.CREDITS || {})[token];
    if (!c) return '<figure class="person"><div class="pn">（缺圖：' + esc(token) + '）</div></figure>';
    return '<figure class="person">'
      + '<img src="img/people/' + esc(c.src) + '" alt="' + esc(c.zh) + '" loading="lazy" decoding="async">'
      + '<figcaption><div class="pn">' + esc(c.zh) + '</div>'
      + '<div class="pc">' + esc(c.cap) + '</div></figcaption></figure>';
  }

  TH.autoPeople = function () {
    document.querySelectorAll('[data-people]').forEach(el => {
      el.innerHTML = el.getAttribute('data-people').split(',')
        .map(s => s.trim()).filter(Boolean).map(card).join('');
    });

    document.querySelectorAll('[data-fig]').forEach(el => {
      const c = (window.CREDITS || {})[el.getAttribute('data-fig')];
      if (!c) { el.innerHTML = '<p class="muted">（缺圖）</p>'; return; }
      const extra = el.getAttribute('data-cap');
      el.innerHTML = '<img src="img/people/' + esc(c.src) + '" alt="' + esc(c.zh) + '" loading="lazy" decoding="async">'
        + '<figcaption>' + esc(extra || c.cap) + '</figcaption>';
    });
  };

  // 圖片來源頁用
  TH.renderSources = function (host) {
    const list = Object.values(window.CREDITS || {});
    const pd = list.filter(c => /public domain|^cc0/i.test(c.license || ''));
    const cc = list.filter(c => !/public domain|^cc0/i.test(c.license || ''));
    const row = c => '<tr><td><a href="' + esc(c.page) + '" target="_blank" rel="noopener">' + esc(c.zh) + '</a></td>'
      + '<td>' + esc(c.artist || '作者不詳') + '</td>'
      + '<td>' + (c.licurl ? '<a href="' + esc(c.licurl) + '" target="_blank" rel="noopener">' + esc(c.license) + '</a>' : esc(c.license)) + '</td></tr>';
    host.innerHTML =
      '<h2>需姓名標示的圖片（' + cc.length + ' 張）</h2>'
      + '<div class="tablewrap"><table><thead><tr><th>圖片</th><th>作者</th><th>授權</th></tr></thead><tbody>'
      + cc.map(row).join('') + '</tbody></table></div>'
      + '<h2>公有領域／CC0（' + pd.length + ' 張）</h2>'
      + '<div class="tablewrap"><table><thead><tr><th>圖片</th><th>作者</th><th>標示</th></tr></thead><tbody>'
      + pd.map(row).join('') + '</tbody></table></div>';
  };

  TH.boot = function () {
    if (TH.autoPeople) TH.autoPeople();
    if (TH.autoMaps) TH.autoMaps();
  };
})();

document.addEventListener('DOMContentLoaded', function () { window.TH.boot(); });
