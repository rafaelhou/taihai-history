// img/credits.json → ../data/credits.js
// 用 JS 檔而不是讓前端 fetch JSON，是為了讓網站直接用 file:// 打開也能跑。
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'img', 'credits.json');
const out = path.join(__dirname, '..', 'data', 'credits.js');

const list = JSON.parse(fs.readFileSync(src, 'utf8'));
const byId = {};
for (const c of list) byId[c.id] = c;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out,
  '/* 由 build/make-credits.js 產生，不要手改。來源見 build/images.json */\n' +
  'window.CREDITS = ' + JSON.stringify(byId, null, 0) + ';\n', 'utf8');

const cc = list.filter(c => !/public domain|^cc0/i.test(c.license || ''));
console.log(`${list.length} 張圖 → data/credits.js（其中 ${cc.length} 張需姓名標示）`);
for (const c of cc) console.log(`  ${c.id.padEnd(15)} ${c.license}  ${c.artist}`);
