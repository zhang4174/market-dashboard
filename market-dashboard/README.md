# 淘宝女鞋市场情报看板

基于多份淘宝/天猫销量排序 Excel 生成的市场情报单页看板。页面左上角可按日期和关键词切换数据集，每次只分析当前选中的单份数据。

## 打开方式

推荐使用本地静态服务：

```bash
python3 -m http.server 8176 --directory /Users/mac/Documents/TVC/market-dashboard
```

然后访问：

```text
http://127.0.0.1:8176/
```

也可以直接打开 `standalone.html`，这是已内联 CSS、JS 和数据的离线单文件版本。

## 重新生成数据

```bash
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/mac/Documents/TVC/market-dashboard/scripts/build_dashboard.py
```

当前默认数据源：

- `/Users/mac/Documents/TVC/outputs/taobao_dexunxie_nv_sales_top100_pages.xlsx`
- `/Users/mac/Documents/TVC/outputs/taobao_banxie_nv_sales_top100_pages_20260819.xlsx`
- `/Users/mac/Documents/TVC/outputs/taobao_dexunxie_nv_price500plus_sales_top100_pages.xlsx`（生成时强制过滤 `价格 >= 500`）

生成后如需更新离线单文件：

```bash
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/mac/Documents/TVC/market-dashboard/scripts/bundle_standalone.py
```

## 数据口径

- 销量：从「3000+人收货」等文本中提取数值，用于排序和估算展示。
- 颜色分布：按颜色同义词归组，例如「白」会归入「白色」，覆盖「小白鞋、银白、黑白」等标题写法。
- 重复铺货：按去掉 CDN host 和尺寸后缀后的主图 URL canonical key 识别同图多链接，单店多链接和跨店共用同一张主图都计入。
- 视觉同质化：当前只展示重复铺货，不再分析 pHash 款式撞款。
