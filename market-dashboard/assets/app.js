const $ = (selector) => document.querySelector(selector);
const esc = (value) => (value == null ? "" : String(value)).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function number(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function money(value, digits = 0) {
  return "¥" + Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

$("#h1").textContent = `${D.keyword} · 市场情报看板`;
$("#sub").textContent = `基于${D.platform}「${D.keyword}」按${D.sort}抓取前 ${D.pages} 页，共 ${number(D.kpi.total_products)} 个商品、${number(D.kpi.total_shops)} 家店铺的多维度分析。`;
$("#meta").innerHTML = [
  `平台：${D.platform}`,
  `关键词：${D.keyword}`,
  `排序：${D.sort}`,
  `页数：${D.pages}`,
  `生成：${D.generated_at}`
].map((item) => `<span>${esc(item)}</span>`).join("");
$("#footer").textContent = `由 WorkBuddy 数据生成 · 数据仅供市场研究参考 · ${D.generated_at}`;

const kpis = [
  { label: "商品总数", value: number(D.kpi.total_products), unit: "件", sub: `其中广告位 ${number(D.kpi.ad_count)} 个` },
  { label: "均价 / 中位数", value: money(D.kpi.avg_price), unit: ` / ${money(D.kpi.median_price)}`, sub: `价格区间 ${money(D.kpi.min_price, 2)} - ${money(D.kpi.max_price, 0)}` },
  { label: "店铺数", value: number(D.kpi.total_shops), unit: "家", sub: `分布在 ${number(D.kpi.total_locations)} 个产地` },
  { label: "视觉唯一主图", value: number(D.kpi.unique_images), unit: "张", sub: `重复铺货 ${D.visual_meta.dup_groups_count} 组 / 近似款 ${D.visual_meta.style_groups_count} 组` }
];

$("#kpi").innerHTML = kpis.map((item) => `
  <div class="card kpi">
    <div class="label">${esc(item.label)}</div>
    <div class="value">${item.value}<span class="unit">${esc(item.unit)}</span></div>
    <div class="sub">${esc(item.sub)}</div>
  </div>
`).join("");

function bars(id, rows, formatter) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  $(id).innerHTML = rows.map((row) => {
    const pct = (row.count / max * 100).toFixed(1);
    const name = row.name || row.range || row.location || row.shop;
    const value = formatter ? formatter(row) : number(row.count);
    return `
      <div class="bar-row">
        <div class="bar-label" title="${esc(name)}">${esc(name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-val">${esc(value)}</div>
      </div>
    `;
  }).join("");
}

bars("#price", D.price_dist, (row) => `${number(row.count)} (${row.percent})`);
bars("#styles", D.styles);
bars("#brands", D.brands, (row) => `${number(row.count)} (${row.percent}%)`);
bars("#locations", D.locations);

const colorMap = {
  "白色": "#f5f5f5", "黑色": "#262626", "灰色": "#9ca3af", "棕色": "#92400e",
  "粉色": "#fbcfe8", "红色": "#dc2626", "蓝色": "#3b82f6", "绿色": "#16a34a",
  "黄色": "#facc15", "紫色": "#a855f7", "杏色": "#d6b89a", "银色": "#d1d5db", "金色": "#d4af37"
};

$("#colors").innerHTML = `<div class="color-grid">${D.colors.map((color) => {
  const fill = colorMap[color.name] || "#ccc";
  return `
    <div class="swatch">
      <div class="dot" style="background:${fill}"></div>
      <div>${esc(color.name)}</div>
      <div class="cnt">${number(color.count)}</div>
    </div>
  `;
}).join("")}</div>`;

const maxWord = Math.max(...D.hot_words.map((word) => word.count), 1);
const minWord = Math.min(...D.hot_words.map((word) => word.count), maxWord);
$("#cloud").innerHTML = D.hot_words.map((word) => {
  const t = maxWord === minWord ? 1 : (word.count - minWord) / (maxWord - minWord);
  const scale = (0.85 + t * 1.45).toFixed(2);
  const weight = t > 0.6 ? 700 : t > 0.3 ? 500 : 400;
  return `<span style="font-size:${scale}em;font-weight:${weight}" title="出现 ${number(word.count)} 次">${esc(word.word)}</span>`;
}).join("");

$("#duptbody").innerHTML = D.dup_shops.map((row, index) => {
  const cls = row.dup_rate >= 50 ? "rate-high" : row.dup_rate >= 30 ? "rate-mid" : "";
  return `
    <tr>
      <td>${index + 1}</td>
      <td><b>${esc(row.shop)}</b></td>
      <td>${number(row.links)}</td>
      <td>${number(row.unique_imgs)}</td>
      <td><span class="rate-bar"><span class="rate-fill" style="width:${Math.min(row.dup_rate, 100)}%"></span></span><span class="${cls}">${row.dup_rate}%</span></td>
    </tr>
  `;
}).join("");

$("#products").innerHTML = D.top_products.map((product) => `
  <div class="prod">
    <a href="${esc(product.url || "#")}" target="_blank" rel="noopener">
      ${product.image ? `<img loading="lazy" src="${esc(product.image)}" alt="">` : ""}
      <div class="info">
        <div class="t">${esc(product.title)}</div>
        <div class="pr">${money(product.price)}<span class="y"> 起</span></div>
        <div class="sa">${esc(product.sales_raw || "")}</div>
        <div class="sh">${esc(product.shop)} · ${esc(product.location)}</div>
      </div>
    </a>
  </div>
`).join("");

$("#dupCnt").textContent = D.visual_meta.dup_groups_count;
$("#styleCnt").textContent = D.visual_meta.style_groups_count;
$("#visualNote").textContent = `展示重复铺货 TOP ${D.dup_groups.length} 组、近似款 TOP ${D.style_groups.length} 组；全量共 ${D.visual_meta.dup_groups_count} 组重复铺货、${D.visual_meta.style_groups_count} 组标题特征近似款。`;

function salesFmt(value) {
  const n = Number(value || 0);
  if (!n) return "—";
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万+` : `${number(n)}+`;
}

function priceRange(shop) {
  if (!shop.price_min) return "价格未知";
  if (shop.price_min === shop.price_max) return money(shop.price_min);
  return `${money(shop.price_min)}-${money(shop.price_max)}`;
}

function shopLines(group) {
  const lines = group.shops.map((shop) => `
    <div class="vshopline">
      <span class="sn">${esc(shop.shop)}</span>
      <span class="sd">${number(shop.links)}链接 · ${priceRange(shop)} · 销量${salesFmt(shop.est_sales)}</span>
    </div>
  `).join("");
  const more = group.shops_total > group.shops.length
    ? `<div class="vshopline"><span class="sd">另有 ${group.shops_total - group.shops.length} 家店...</span></div>`
    : "";
  return lines + more;
}

function renderRepresentatives(groupKey, groupIndex, group, extraClass = "") {
  return (group.representatives || []).map((rep, repIndex) => `
    <div class="vi ${extraClass}" data-gi="${groupIndex}" data-ri="${repIndex}" onclick="showRep(event, '${groupKey}', ${groupIndex}, ${repIndex})">
      <img loading="lazy" src="${esc(rep.image)}" alt="">
      ${rep.count > 1 ? `<span class="vc">${number(rep.count)}链接</span>` : ""}
    </div>
  `).join("");
}

function renderDup(group, index) {
  const tagClass = group.tag === "single" ? "single" : "cross";
  const tagText = group.tag === "single" ? "单店重复铺货" : "跨店同款";
  const note = group.tag === "single"
    ? "同一家店使用完全相同的主图上架多个链接，常见于多色 SKU 或相近标题占位。"
    : "同一张主图被多家店铺共用，可能来自同源供货图、分销图或跨店复制。";
  return `
    <div class="vcard" onclick="this.classList.toggle('open')">
      <div class="vrow">
        ${group.representative ? `<img class="vthumb" loading="lazy" src="${esc(group.representative)}" alt="">` : ""}
        <div class="vmain">
          <div class="vtitle">${esc(group.sample_title)}</div>
          <div class="vshop"><span class="vtag ${tagClass}">${tagText}</span>${esc(group.sample_shop)}</div>
        </div>
        <div class="vstats">
          <div class="vst"><div class="v red">${number(group.link_count)}</div><div class="l">个链接</div></div>
          <div class="vst"><div class="v">${number(group.unique_images)}</div><div class="l">张主图</div></div>
          <div class="vst"><div class="v">${number(group.shop_count)}</div><div class="l">家店</div></div>
        </div>
      </div>
      <div class="vexpand">
        <div class="vsub-label">该主图被用于 ${number(group.link_count)} 个商品链接，点击主图查看对应商品：</div>
        <div class="vimgs dup-vimgs" id="dup_groups-vimgs-${index}">${renderRepresentatives("dup_groups", index, group, "dup-rep")}</div>
        <div class="style-links-panel" id="dup_groups-links-${index}"></div>
        <div style="margin-top:12px">${shopLines(group)}<div class="vnote">${esc(note)}</div></div>
      </div>
    </div>
  `;
}

function renderStyle(group, index) {
  const reps = renderRepresentatives("style_groups", index, group, "style-rep");
  const brands = group.brands && group.brands.length > 1
    ? `<div class="brand-tags">${group.brands.map((brand) => `<span class="btag">${esc(brand)}</span>`).join("")}</div>`
    : "";
  return `
    <div class="vcard" onclick="this.classList.toggle('open')">
      <div class="vrow">
        ${group.representative ? `<img class="vthumb" loading="lazy" src="${esc(group.representative)}" alt="">` : ""}
        <div class="vmain">
          <div class="vtitle">${esc(group.sample_title)}</div>
          <div class="vshop"><span class="vtag style">款式撞款</span>${number(group.unique_images)}张不同主图 · ${number(group.brand_count)}个品牌 · ${number(group.shop_count)}家店</div>
        </div>
        <div class="vstats">
          <div class="vst"><div class="v red">${number(group.link_count)}</div><div class="l">个链接</div></div>
          <div class="vst"><div class="v">${number(group.unique_images)}</div><div class="l">张近似图</div></div>
          <div class="vst"><div class="v">${number(group.shop_count)}</div><div class="l">家店</div></div>
        </div>
      </div>
      <div class="vexpand">
        <div class="vsub-label">按标题特征聚类得到的近似款，点击主图查看对应商品链接：</div>
        <div class="vimgs style-vimgs" id="style_groups-vimgs-${index}">${reps}</div>
        ${brands}
        <div class="style-links-panel" id="style_groups-links-${index}"></div>
        <div style="margin-top:12px">${shopLines(group)}<div class="vnote">基于标题里的鞋型、底型、风格与颜色词近似归组，不等同于图像指纹识别，适合快速发现跟款方向。</div></div>
      </div>
    </div>
  `;
}

function showRep(event, listKey, groupIndex, repIndex) {
  event.stopPropagation();
  const group = D[listKey][groupIndex];
  if (!group) return;
  const rep = (group.representatives || [])[repIndex];
  if (!rep || !rep.members) return;
  const grid = document.getElementById(`${listKey}-vimgs-${groupIndex}`);
  const panel = document.getElementById(`${listKey}-links-${groupIndex}`);
  const item = grid && grid.querySelectorAll(".vi")[repIndex];
  const isActive = item && item.classList.contains("active");
  if (grid) grid.querySelectorAll(".vi").forEach((el) => el.classList.remove("active"));
  if (isActive) {
    if (panel) {
      panel.style.display = "none";
      panel.innerHTML = "";
    }
    return;
  }
  if (item) item.classList.add("active");
  const members = rep.members.map((member) => `
    <a class="dup-link" href="${esc(member.url || "#")}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
      <img loading="lazy" src="${esc(member.image || rep.image)}" alt="">
      <div class="dtxt">
        <div class="dt">${esc(member.title || group.sample_title)}</div>
        <div class="dp">${money(member.price)}</div>
        <div class="ds">${esc(member.shop || "")} · ${esc(member.sales_raw || "")}</div>
      </div>
    </a>
  `).join("");
  const more = rep.count > rep.members.length
    ? `<a class="dup-more" href="${esc(rep.url || "#")}" target="_blank" rel="noopener" onclick="event.stopPropagation()">该主图共 ${number(rep.count)} 个商品链接，打开代表链接</a>`
    : "";
  if (panel) {
    panel.innerHTML = `<div class="vsub-label">「${esc(rep.title || group.sample_title)}」对应商品链接（展示 ${number(rep.members.length)} / ${number(rep.count)}）</div><div class="dup-links">${members}</div>${more}`;
    panel.style.display = "block";
  }
}

$("#visualDup").innerHTML = D.dup_groups.map(renderDup).join("");
$("#visualStyle").innerHTML = D.style_groups.map(renderStyle).join("");

document.querySelectorAll(".vtab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".vtab").forEach((item) => item.classList.remove("on"));
    tab.classList.add("on");
    const key = tab.dataset.tab;
    $("#visualDup").hidden = key !== "dup";
    $("#visualStyle").hidden = key !== "style";
  });
});
