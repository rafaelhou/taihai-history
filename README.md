# 泉漳本無史

從閩越到台海的兩千兩百年。泉國與漳國的歷史，搭配互動地圖與歷代人物圖像。

純靜態網站，沒有前端框架，也沒有建置步驟——`build/` 底下的東西只在「要重新產生地圖資料或重抓圖片」時才需要跑。

## 內容

| 頁 | 章 | 年代 |
|---|---|---|
| `index.html` | 序：泉漳本無史 + 時間軸 + 連橫那 500 銀元 | |
| `ch1-minyue.html` | 閩越國與福語中斷 | 306 BC – 3 世紀 |
| `ch2-nanchao.html` | 梁安郡與真諦法師 | 3 – 6 世紀 |
| `ch3-tang.html` | 開漳與海上絲路 | 7 – 9 世紀 |
| `ch4-wudai.html` | 開閩三王與泉漳納土 | 885 – 978 |
| `ch5-songyuan.html` | 蒲壽庚與世界最大港 | 10 – 14 世紀 |
| `ch6-yisibaxi.html` | 泉福興汀‧什葉遜尼大戰 | 1357 – 1366 |
| `ch7-zheng.html` | 未能成形的台海國 | 1567 – 1683 |
| `ch8-duidu.html` | 對渡與頂下郊拚 | 1684 – 1853 |
| `ch9-minguo.html` | 閩南護法區、閩南王、泉南王 | 1918 – 1932 |
| `sources.html` | 圖片來源與授權 | |

## 地圖

**海岸線是真的，其他都是手繪的。** 這件事在每張圖下面都有註明，因為兩者混在同一張圖上很容易讓人誤會。

- 底圖取自 [Natural Earth](https://www.naturalearthdata.com/) 1:10m 的 `ne_10m_land` 與 `ne_10m_minor_islands`（公有領域），由 `build/make-map.js` 裁切、Douglas–Peucker 簡化、Mercator 投影後輸出成 `map-data.js`。三個視域：
  - `taihai` — 主要視域，涵蓋海南到江淮（北界拉到 34°N 是為了讓迫遷江淮、開閩三王南奔、真諦到建康這幾條線的起訖點都在同一張底圖上）
  - `asia` — 真諦法師航路用的南亞至東亞大範圍圖
  - `taipei` — 頂下郊拚用的台北盆地
- 疆域、語區、進軍路線、航路、台北盆地的河道與聚落，全部在 `data/maps.js` 裡以經緯度手繪。疆域用 SVG `clipPath` 夾住底圖陸地，所以**海岸那一側會自動貼齊真實海岸線**，只有內陸邊界是示意的。

各章要顯示哪張圖，是靠 HTML 裡的 `<div class="mapblock" data-map="鍵">`，鍵對應 `data/maps.js` 的 `MAPS`。

### 命中判定

`map.js` 刻意**不做拖曳平移縮放**，改用「焦點」按鈕切 viewBox。理由是之前在 world-flags 那個站，拖曳配 `setPointerCapture` 會讓 `click` 的 target 重指向捕捉元素，害觸控裝置整個點不到，查很久。沒有拖曳就沒有那個問題。

有踩到並修掉的一個：地點的透明點擊圓在螢幕上是固定大小，但鹿耳門與熱蘭遮城只差 6 公里，圓一放大就互相搶點擊，後畫的永遠贏。解法是把半徑限制在「與最近鄰點距離的 45%」以內。

`build/hittest.js` 是命中判定的稽核，用 `document.elementFromPoint` 走瀏覽器真正的命中堆疊，**遍歷全部目標**而不是抽驗（用 `dispatchEvent` 合成事件會直接命中目標元素，完全繞過真實游標的命中判定與事件路徑，測不出這類 bug）。目前 13 張圖 151 個目標全數通過。

## 圖片

33 張人物與場景圖取自 Wikimedia Commons，存在 `img/people/`，作者與授權在 `img/credits.json`（並由 `build/make-credits.js` 轉成 `data/credits.js` 給前端用，避免 `fetch` 讓 `file://` 開不起來）。

查無可信圖像傳世的人物（真諦法師、蒲壽庚、蒲師文、恭順、張貞、陳國輝），`people.js` 會畫一枚印記代替，不拿別人的畫像充數。

## 要重新產生資料時

```bash
node build/make-map.js       # 圖資 → map-data.js
node build/make-credits.js   # img/credits.json → data/credits.js
```

原始 geojson 沒進版控，要的話先跑 `build/get-geodata.ps1` 重抓。

重抓圖片是 `build/get-images.ps1`（清單在 `build/images.json`）。抓 `upload.wikimedia.org` 會被 429 擋，所以帶了可識別的 User-Agent 並在檔與檔之間隔 2 秒。

> **PowerShell 5.1 的坑**：`build/` 底下的 `.ps1` 必須維持純 ASCII。PS 5.1 讀無 BOM 的 UTF-8 指令碼會當成 ANSI，中文字串會整個變成亂碼——而且不會報錯，是靜靜地寫進資料裡。所以中文一律放在 `images.json`，用 `Get-Content -Encoding UTF8` 明確解碼。

## 計數器

頁尾的瀏覽次數存在 Supabase（與其他站共用同一個專案），`counter.js` 裡的 publishable key 是設計成公開的，安全性由資料庫端的 RLS 加 security definer 函式保證。

**新站要先在 Supabase 新增一列計數器**，否則 `increment_counter` 會對未知 id 丟例外，前端收到 400 就把整塊藏起來。SQL 在 `sql/counter.sql`。

## 授權

Natural Earth 圖資為公有領域。人物與場景圖像著作權屬各原作者，依其授權條款使用，詳見 `sources.html`。
