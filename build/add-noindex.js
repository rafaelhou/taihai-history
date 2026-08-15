// 一次替所有站加上「不要被搜尋到」的設定。
//   1. robots.txt  —— 擋 AI 爬蟲，但放搜尋引擎進來（理由見下）
//   2. _headers    —— Cloudflare Pages 用，連圖片等非 HTML 檔也蓋到
//   3. 每個 .html 的 <head> 插入 <meta name="robots" content="noindex, follow">
//
// 為什麼不用 robots.txt 的 Disallow 擋搜尋引擎：
//   Google 必須「抓得到頁面」才讀得到 noindex。用 Disallow 把它擋在門外，
//   它就永遠看不到 noindex，反而可能因為別處的連結，把網址以無摘要的形式
//   留在搜尋結果裡。要真的移出索引，必須讓它進來、然後看到 noindex。
//   AI 爬蟲則相反：它們不需要抓到頁面就能遵守 robots.txt，所以直接擋。
//
// 用法：node add-noindex.js [--dry]
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\MyPorjects';
const SITES = [
  'rafaelhou.github.io', 'minecraft-parent-guide', 'steam-with-kids', 'kids-investing',
  'wmi-prep', 'world-flags', 'grade3-toolbox', 'kids-practice', 'minecraft-economy',
  'ai-literacy-notes', 'taihai-history',
];
const DRY = process.argv.includes('--dry');

const ROBOTS = `# 這個站不希望被搜尋引擎收錄，也不希望被拿去訓練 AI。
#
# 注意這裡「沒有」對一般搜尋引擎下 Disallow，那是刻意的：
# Google 必須抓得到頁面才讀得到每一頁的 <meta name="robots" content="noindex">。
# 若在這裡把它擋掉，它反而看不到 noindex，網址可能因為外部連結
# 以「無摘要」的形式留在搜尋結果裡。要真的移出索引，得讓它進來看到 noindex。
User-agent: *
Allow: /

# AI 訓練與 AI 搜尋的爬蟲：直接擋。
# 這些不需要抓到頁面就能遵守本檔規則，所以 Disallow 是有效的。
User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Perplexity-User
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: ImagesiftBot
Disallow: /
`;

// Cloudflare Pages 讀這個檔加回應標頭。HTML 以外的檔（圖片、SVG、PDF）
// 沒地方放 meta 標籤，只能靠標頭。GitHub Pages 不支援，放著無害。
const HEADERS = `/*
  X-Robots-Tag: noindex, noarchive
`;

const META = '<meta name="robots" content="noindex, follow">';

function injectMeta(html) {
  if (/<meta[^>]+name=["']robots["']/i.test(html)) return null;      // 已經有了
  const m = html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i)
         || html.match(/<meta[^>]+charset[^>]*>/i);
  if (m) {
    const at = html.indexOf(m[0]) + m[0].length;
    return html.slice(0, at) + '\n' + META + html.slice(at);
  }
  const h = html.search(/<\/head>/i);
  if (h === -1) return undefined;                                    // 沒有 head，跳過
  return html.slice(0, h) + META + '\n' + html.slice(h);
}

let files = 0, metaAdded = 0, metaSkipped = 0, problems = [];

for (const site of SITES) {
  const dir = path.join(ROOT, site);
  if (!fs.existsSync(dir)) { problems.push(`${site}: 目錄不存在`); continue; }

  if (!DRY) {
    fs.writeFileSync(path.join(dir, 'robots.txt'), ROBOTS, 'utf8');
    fs.writeFileSync(path.join(dir, '_headers'), HEADERS, 'utf8');
  }

  const htmls = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.toLowerCase().endsWith('.html')) htmls.push(full);
    }
  })(dir);

  let added = 0, skipped = 0;
  for (const f of htmls) {
    files++;
    const html = fs.readFileSync(f, 'utf8');
    const out = injectMeta(html);
    if (out === null) { skipped++; metaSkipped++; continue; }
    if (out === undefined) { problems.push(`${site}/${path.basename(f)}: 找不到 <head>`); continue; }
    if (!DRY) fs.writeFileSync(f, out, 'utf8');
    added++; metaAdded++;
  }
  console.log(`${site.padEnd(24)} html=${String(htmls.length).padStart(2)}  加了 meta=${added}  本來就有=${skipped}`);
}

console.log(`\n${DRY ? '[試跑] ' : ''}共 ${files} 個 HTML：新增 meta ${metaAdded}、原本就有 ${metaSkipped}`);
if (problems.length) { console.log('\n問題：'); problems.forEach(p => console.log('  ' + p)); }
