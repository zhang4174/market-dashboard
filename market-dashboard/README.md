# 德训鞋女市场情报看板

基于 `/Users/mac/WorkBuddy/lin'shi/market-intel/output/德训鞋女_销量排序_100页_原始数据.xlsx` 生成的淘宝/天猫市场情报单页看板。

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

生成后如需更新离线单文件：

```bash
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/mac/Documents/TVC/market-dashboard/scripts/bundle_standalone.py
```

## 数据口径

- 销量：从「3000+人收货」等文本中提取数值，用于排序和估算展示。
- 颜色分布：按颜色同义词归组，例如「白」会归入「白色」，覆盖「小白鞋、银白、黑白」等标题写法。
- 重复铺货：按带 CDN host 的主图 URL canonical key 识别同图多链接。
- 款式撞款：先对 canonical 主图计算 DCT pHash，用汉明距离阈值识别视觉相似组，再按 canonical 主图去重统计，过滤被单个重复主图/单品牌强烈主导的组合，避免单店批量铺货混入撞款榜。
