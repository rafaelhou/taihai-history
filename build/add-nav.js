// 在每一頁的導覽列插入第十章的連結。
// 用 node 而不是 PowerShell，是因為這裡要處理中文——PS 5.1 讀無 BOM 的 UTF-8 會當成 ANSI。
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const LINK = '    <a href="ch10-chao.html">十 潮</a>\n';
const ANCHOR = '    <a href="sources.html">';

let changed = 0, skipped = 0;
for (const f of fs.readdirSync(root).filter(n => n.endsWith('.html'))) {
  const p = path.join(root, f);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('ch10-chao.html')) { skipped++; console.log(`skip  ${f}（已經有了）`); continue; }
  if (!s.includes(ANCHOR)) { console.log(`WARN  ${f}：找不到插入點`); continue; }
  s = s.replace(ANCHOR, LINK + ANCHOR);
  fs.writeFileSync(p, s, 'utf8');
  changed++;
  console.log(`ok    ${f}`);
}
console.log(`\n${changed} 頁已加入，${skipped} 頁本來就有`);
