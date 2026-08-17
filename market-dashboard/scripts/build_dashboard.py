from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd


SOURCE_PATH = Path("/Users/mac/WorkBuddy/lin'shi/market-intel/output/德训鞋女_销量排序_100页_原始数据.xlsx")
OUT_PATH = Path(__file__).resolve().parents[1] / "data.js"


COLOR_TERMS = ["白色", "黑色", "灰色", "棕色", "粉色", "红色", "蓝色", "绿色", "黄色", "紫色", "杏色", "银色", "金色"]
STYLE_TERMS = [
    "休闲", "新款", "板鞋", "百搭", "透气", "阿甘", "复古", "厚底", "内增高", "芭蕾",
    "软底", "运动休闲", "平底", "轻便", "真皮", "网面", "小白", "薄底", "玛丽珍",
    "魔术贴", "帆布", "凉鞋", "老爹", "跑步", "学生", "防滑", "勃肯", "乐福", "T头",
]
HOT_WORDS = [
    "德训鞋", "新款", "运动鞋", "板鞋", "百搭", "透气", "夏款", "阿甘鞋", "内增高", "休闲鞋",
    "复古", "小白鞋", "厚底", "网面", "秋款", "芭蕾鞋", "软底", "平底", "真皮", "薄底",
    "轻便", "同款", "爆款", "春款", "系带", "老爹鞋", "学生", "跑步", "情侣", "ins风",
    "帆布鞋", "通勤", "防滑", "魔术贴", "正品", "显瘦", "大码", "勃肯鞋", "小码", "减震",
    "乐福鞋", "亲子",
]
BRANDS = [
    ("adidas", ["adidas", "阿迪达斯", "三叶草", "samba"]),
    ("回力", ["回力"]),
    ("环球", ["环球", "huanqiu"]),
    ("达芙妮", ["达芙妮", "daphne"]),
    ("kappa", ["kappa"]),
    ("拉夏贝尔", ["拉夏贝尔"]),
    ("苏茵茵", ["苏茵茵"]),
    ("卓诗尼", ["卓诗尼"]),
    ("奥古狮登", ["奥古狮登"]),
    ("热风", ["热风", "hotwind"]),
    ("星期六", ["星期六", "st&sat"]),
    ("百丽", ["百丽", "belle"]),
    ("puma", ["puma", "彪马"]),
    ("fila", ["fila", "斐乐"]),
    ("champion", ["champion"]),
    ("魀品", ["魀品"]),
    ("骆驼", ["骆驼", "camel"]),
    ("weflower", ["weflower"]),
    ("leecooper", ["lee cooper", "leecooper"]),
    ("snowelf", ["snowelf"]),
    ("李宁", ["李宁", "lining"]),
    ("skechers", ["skechers", "斯凯奇"]),
    ("crocs", ["crocs", "卡骆驰"]),
    ("ugg", ["ugg"]),
    ("teva", ["teva"]),
    ("clarks", ["clarks"]),
]
PROVINCES = [
    "黑龙江", "内蒙古", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
    "广东", "广西", "海南", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏",
    "新疆", "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "台湾", "香港", "澳门",
]


def clean_nan(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def parse_sales(value) -> int:
    text = str(clean_nan(value) or "")
    text = text.replace(",", "").strip()
    match = re.search(r"(\d+(?:\.\d+)?)\s*万", text)
    if match:
        return int(float(match.group(1)) * 10000)
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if match:
        return int(float(match.group(1)))
    return 0


def normalize_image(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(str(url).strip())
    path = parsed.path or str(url)
    match = re.match(r"(.+?\.(?:jpg|jpeg|png|webp))(?:[_?].*)?$", path, flags=re.I)
    return (match.group(1) if match else path).lower()


def province(location: str) -> str:
    text = str(clean_nan(location) or "").strip()
    for item in PROVINCES:
        if text.startswith(item):
            return item
    return text[:2] if text else "未知"


def first_brand(title: str, shop: str) -> str | None:
    haystack = f"{title} {shop}".lower()
    for brand, patterns in BRANDS:
        if any(pattern.lower() in haystack for pattern in patterns):
            return brand
    return None


def count_terms(titles: pd.Series, terms: list[str], top_n: int | None = None) -> list[dict]:
    counter = Counter()
    for title in titles.fillna("").astype(str):
        lower = title.lower()
        for term in terms:
            if term.lower() in lower:
                counter[term] += 1
    rows = [{"name": key, "count": value} for key, value in counter.most_common(top_n)]
    return rows


def price_distribution(prices: pd.Series) -> list[dict]:
    bins = [
        ("<¥100", -math.inf, 100),
        ("¥100-150", 100, 150),
        ("¥150-200", 150, 200),
        ("¥200-300", 200, 300),
        ("¥300-500", 300, 500),
        ("¥500-800", 500, 800),
        ("¥800-1200", 800, 1200),
        ("¥1200+", 1200, math.inf),
    ]
    total = len(prices)
    rows = []
    for label, low, high in bins:
        if math.isinf(low):
            count = int((prices < high).sum())
        elif math.isinf(high):
            count = int((prices >= low).sum())
        else:
            count = int(((prices >= low) & (prices < high)).sum())
        rows.append({"range": label, "count": count, "percent": f"{count / total * 100:.1f}%"})
    return rows


def product_record(row: pd.Series) -> dict:
    return {
        "title": str(row["商品标题"]),
        "price": round(float(row["价格(元)"]), 2),
        "sales_num": int(row["sales_num"]),
        "sales_raw": str(row["销量"]),
        "shop": str(row["店铺"]),
        "url": str(row["商品链接"]),
        "image": str(row["主图链接"]),
        "location": str(row["产地"]),
    }


def shop_summary(group: pd.DataFrame, limit: int = 8) -> tuple[list[dict], int]:
    rows = []
    for shop, part in group.groupby("店铺"):
        prices = part["价格(元)"].astype(float)
        rows.append({
            "shop": str(shop),
            "links": int(len(part)),
            "price_min": round(float(prices.min()), 2),
            "price_max": round(float(prices.max()), 2),
            "price_avg": round(float(prices.mean())),
            "est_sales": int(part["sales_num"].sum()),
        })
    rows.sort(key=lambda item: (-item["links"], -item["est_sales"], item["shop"]))
    return rows[:limit], len(rows)


def representatives_for_exact_image(group: pd.DataFrame) -> list[dict]:
    members = [product_record(row) for _, row in group.sort_values(["sales_num", "排名"], ascending=[False, True]).head(12).iterrows()]
    first = members[0]
    return [{
        "image": first["image"],
        "title": first["title"],
        "shop": first["shop"],
        "price": first["price"],
        "url": first["url"],
        "count": int(len(group)),
        "members": members,
    }]


def duplicate_groups(df: pd.DataFrame, top_n: int = 20) -> tuple[list[dict], int]:
    groups = []
    grouped = df[df["image_key"] != ""].groupby("image_key")
    for _, part in grouped:
        if len(part) < 2:
            continue
        part = part.sort_values(["sales_num", "排名"], ascending=[False, True])
        first = part.iloc[0]
        shops, shops_total = shop_summary(part)
        groups.append({
            "tag": "single" if part["店铺"].nunique() == 1 else "cross",
            "tag_label": "单店重复铺货" if part["店铺"].nunique() == 1 else "跨店同款",
            "link_count": int(len(part)),
            "unique_images": int(part["image_key"].nunique()),
            "shop_count": int(part["店铺"].nunique()),
            "sample_title": str(first["商品标题"]),
            "sample_shop": str(first["店铺"]),
            "sample_price": round(float(first["价格(元)"]), 2),
            "shops": shops,
            "shops_total": shops_total,
            "representatives": representatives_for_exact_image(part),
            "representative": str(first["主图链接"]),
        })
    groups.sort(key=lambda item: (-item["link_count"], -item["shop_count"], item["sample_shop"]))
    return groups[:top_n], len(groups)


def style_signature(row: pd.Series) -> tuple[str, ...] | None:
    title = str(row["商品标题"])
    lower = title.lower()
    terms = []
    for term in STYLE_TERMS:
        if term.lower() in lower and term not in {"新款", "休闲", "百搭", "透气"}:
            terms.append(term)
    for color in COLOR_TERMS:
        if color in title:
            terms.append(color)
    if len(terms) < 2:
        return None
    price = float(row["价格(元)"])
    if price < 100:
        band = "低价"
    elif price < 250:
        band = "中价"
    elif price < 500:
        band = "中高价"
    else:
        band = "高价"
    return tuple(sorted(set(terms))[:5] + [band])


def style_groups(df: pd.DataFrame, top_n: int = 20) -> tuple[list[dict], int]:
    bucket: dict[tuple[str, ...], list[int]] = defaultdict(list)
    for idx, row in df.iterrows():
        signature = style_signature(row)
        if signature:
            bucket[signature].append(idx)
    groups = []
    for _, indexes in bucket.items():
        part = df.loc[indexes]
        if len(part) < 2 or part["image_key"].nunique() < 2 or part["店铺"].nunique() < 2:
            continue
        brands = sorted({brand for brand in part["brand"].dropna().astype(str) if brand})
        if len(brands) < 2:
            continue
        part = part.sort_values(["sales_num", "排名"], ascending=[False, True])
        first = part.iloc[0]
        shops, shops_total = shop_summary(part)
        reps = []
        for _, img_part in part.groupby("image_key", sort=False):
            img_part = img_part.sort_values(["sales_num", "排名"], ascending=[False, True])
            row = img_part.iloc[0]
            reps.append({
                "image": str(row["主图链接"]),
                "title": str(row["商品标题"]),
                "shop": str(row["店铺"]),
                "price": round(float(row["价格(元)"]), 2),
                "url": str(row["商品链接"]),
                "count": int(len(img_part)),
                "members": [product_record(member) for _, member in img_part.head(8).iterrows()],
            })
        reps.sort(key=lambda item: -item["count"])
        groups.append({
            "tag": "style",
            "tag_label": "款式撞款",
            "link_count": int(len(part)),
            "unique_images": int(part["image_key"].nunique()),
            "shop_count": int(part["店铺"].nunique()),
            "brand_count": len(brands),
            "brands": brands[:8],
            "sample_title": str(first["商品标题"]),
            "sample_shop": str(first["店铺"]),
            "sample_price": round(float(first["价格(元)"]), 2),
            "shops": shops,
            "shops_total": shops_total,
            "representatives": reps[:12],
            "representative": str(first["主图链接"]),
        })
    groups.sort(key=lambda item: (-item["link_count"], -item["brand_count"], -item["shop_count"]))
    return groups[:top_n], len(groups)


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE_PATH
    if not source.exists():
        raise SystemExit(f"Source workbook not found: {source}")

    raw = pd.read_excel(source, sheet_name="德训鞋女-销量排序")
    overview_df = pd.read_excel(source, sheet_name="数据概览")
    overview = dict(zip(overview_df["指标"].astype(str), overview_df["值"]))

    df = raw.copy()
    df["价格(元)"] = pd.to_numeric(df["价格(元)"], errors="coerce")
    df = df.dropna(subset=["价格(元)", "商品标题", "店铺"]).copy()
    df["sales_num"] = df["销量"].map(parse_sales)
    df["image_key"] = df["主图链接"].fillna("").astype(str).map(normalize_image)
    df["province"] = df["产地"].fillna("").astype(str).map(province)
    df["brand"] = [first_brand(title, shop) for title, shop in zip(df["商品标题"], df["店铺"])]

    brand_counter = Counter(brand for brand in df["brand"] if brand)
    branded_products = sum(brand_counter.values()) or 1
    brand_rows = [
        {"name": brand, "count": count, "percent": round(count / branded_products * 100, 1)}
        for brand, count in brand_counter.most_common(20)
    ]
    location_rows = [{"location": key, "count": value} for key, value in Counter(df["province"]).most_common(20)]
    color_rows = count_terms(df["商品标题"], COLOR_TERMS)
    style_rows = count_terms(df["商品标题"], STYLE_TERMS, 15)
    hot_rows = [{"word": row["name"], "count": row["count"]} for row in count_terms(df["商品标题"], HOT_WORDS)]

    dup_groups_rows, dup_total = duplicate_groups(df)
    style_groups_rows, style_total = style_groups(df)

    dup_shop_rows = []
    for shop, part in df.groupby("店铺"):
        links = int(len(part))
        unique_imgs = int(part["image_key"].nunique())
        if links < 3:
            continue
        dup_rate = round((1 - unique_imgs / links) * 100, 1) if links else 0
        if dup_rate <= 0:
            continue
        dup_shop_rows.append({
            "shop": str(shop),
            "links": links,
            "unique_imgs": unique_imgs,
            "dup_rate": dup_rate,
            "est_sales": int(part["sales_num"].sum()),
        })
    dup_shop_rows.sort(key=lambda item: (-item["dup_rate"], -item["links"], -item["est_sales"]))

    top_products = [
        product_record(row)
        for _, row in df.sort_values(["sales_num", "排名"], ascending=[False, True]).head(20).iterrows()
    ]
    generated = overview.get("抓取时间")
    if pd.isna(generated):
        generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    elif not isinstance(generated, str):
        generated = pd.to_datetime(generated).strftime("%Y-%m-%d %H:%M")

    prices = df["价格(元)"].astype(float)
    data = {
        "keyword": str(overview.get("关键词", "德训鞋女")),
        "generated_at": str(generated),
        "platform": "淘宝/天猫",
        "sort": str(overview.get("排序方式", "销量排序")),
        "pages": str(overview.get("抓取页数", "100/100")),
        "kpi": {
            "total_products": int(len(df)),
            "total_shops": int(df["店铺"].nunique()),
            "total_locations": int(df["province"].nunique()),
            "avg_price": round(float(prices.mean()), 2),
            "median_price": round(float(prices.median()), 2),
            "price_p25": round(float(prices.quantile(0.25)), 2),
            "price_p75": round(float(prices.quantile(0.75)), 2),
            "price_p90": round(float(prices.quantile(0.90)), 2),
            "min_price": round(float(prices.min()), 2),
            "max_price": round(float(prices.max()), 2),
            "unique_images": int(df["image_key"].nunique()),
            "ad_count": int(overview.get("其中广告位", 0)),
            "total_brands": int(len(brand_counter)),
            "branded_products": int(sum(brand_counter.values())),
            "unbranded_products": int(len(df) - sum(brand_counter.values())),
        },
        "price_dist": price_distribution(prices),
        "colors": color_rows,
        "styles": style_rows,
        "brands": brand_rows,
        "locations": location_rows,
        "hot_words": hot_rows,
        "top_products": top_products,
        "visual_meta": {
            "dup_groups_count": dup_total,
            "style_groups_count": style_total,
        },
        "dup_groups": dup_groups_rows,
        "style_groups": style_groups_rows,
        "dup_shops": dup_shop_rows[:10],
    }

    OUT_PATH.write_text("const D=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(json.dumps({
        "output": str(OUT_PATH),
        "products": data["kpi"]["total_products"],
        "shops": data["kpi"]["total_shops"],
        "dup_groups": dup_total,
        "style_groups": style_total,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
