from __future__ import annotations

import json
import math
import re
import sys
import hashlib
import io
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import pandas as pd
from PIL import Image, ImageOps


SOURCE_PATHS = [
    Path("/Users/mac/Documents/TVC/outputs/taobao_dexunxie_nv_sales_top100_pages.xlsx"),
    Path("/Users/mac/Documents/TVC/outputs/taobao_banxie_nv_sales_top100_pages_20260819.xlsx"),
]
OUT_PATH = Path(__file__).resolve().parents[1] / "data.js"
CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache" / "phash"
IMAGE_CACHE_DIR = CACHE_DIR / "images"
PHASH_CACHE_PATH = CACHE_DIR / "phash-cache-dct-v1.json"
PHASH_DISTANCE_THRESHOLD = 6
MAX_STYLE_DUPLICATE_IMAGE_LINK_SHARE = 0.6
DATA_SHEET_CANDIDATES = ["德训鞋女-销量排序", "德训鞋女销量前100页", "板鞋女销量前100页"]
DCT_SIZE = 32
HASH_SIZE = 8
DCT_MATRIX = np.array(
    [
        [
            math.sqrt(1 / DCT_SIZE) if i == 0 else math.sqrt(2 / DCT_SIZE) * math.cos((math.pi * (2 * j + 1) * i) / (2 * DCT_SIZE))
            for j in range(DCT_SIZE)
        ]
        for i in range(DCT_SIZE)
    ],
    dtype=np.float32,
)


COLOR_TERMS = ["白色", "黑色", "灰色", "棕色", "粉色", "红色", "蓝色", "绿色", "黄色", "紫色", "杏色", "银色", "金色"]
COLOR_GROUPS = [
    ("白色", ["白"]),
    ("红色", ["红"]),
    ("银色", ["银"]),
    ("黑色", ["黑"]),
    ("蓝色", ["蓝"]),
    ("粉色", ["粉"]),
    ("黄色", ["黄"]),
    ("绿色", ["绿"]),
    ("灰色", ["灰"]),
    ("金色", ["金"]),
    ("棕色", ["棕", "咖"]),
    ("紫色", ["紫"]),
    ("杏色", ["杏"]),
]
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
    ("鮀品", ["鮀品"]),
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
    canonical_path = match.group(1) if match else path
    return canonical_path.lower()


def read_source_workbook(source: Path) -> tuple[pd.DataFrame, dict[str, object]]:
    workbook = pd.ExcelFile(source)
    data_sheet = next((sheet for sheet in DATA_SHEET_CANDIDATES if sheet in workbook.sheet_names), workbook.sheet_names[0])
    raw = pd.read_excel(source, sheet_name=data_sheet)
    raw = raw.rename(columns={"价格": "价格(元)"})

    required_columns = ["排名", "商品标题", "价格(元)", "销量", "店铺", "产地", "商品链接", "主图链接"]
    missing = [column for column in required_columns if column not in raw.columns]
    if missing:
        raise SystemExit(f"Missing required columns in {source}: {', '.join(missing)}")

    overview: dict[str, object] = {}
    if "数据概览" in workbook.sheet_names:
        overview_df = pd.read_excel(source, sheet_name="数据概览")
        if {"指标", "值"}.issubset(overview_df.columns):
            overview = dict(zip(overview_df["指标"].astype(str), overview_df["值"]))

    if "关键词" not in overview:
        sheet_match = re.match(r"(.+?)销量前\d+页", data_sheet)
        overview["关键词"] = sheet_match.group(1) if sheet_match else infer_keyword_from_filename(source)
    if "排序方式" not in overview:
        overview["排序方式"] = "销量排序"
    if "抓取页数" not in overview and "页码" in raw.columns and raw["页码"].notna().any():
        max_page = int(pd.to_numeric(raw["页码"], errors="coerce").max())
        overview["抓取页数"] = f"{max_page}/{max_page}"
    if "其中广告位" not in overview:
        overview["其中广告位"] = int(raw["商品链接"].fillna("").astype(str).str.contains("click.simba.taobao.com").sum())

    return raw, overview


def infer_keyword_from_filename(source: Path) -> str:
    stem = source.stem.lower()
    if "dexunxie_nv" in stem or "德训鞋女" in stem:
        return "德训鞋女"
    if "banxie_nv" in stem or "板鞋女" in stem:
        return "板鞋女"
    return source.stem


def source_date(source: Path, generated: object | None = None) -> str:
    match = re.search(r"(20\d{6})", source.stem)
    if match:
        value = match.group(1)
        return f"{value[:4]}-{value[4:6]}-{value[6:8]}"
    if generated and not pd.isna(generated):
        try:
            return pd.to_datetime(generated).strftime("%Y-%m-%d")
        except (TypeError, ValueError):
            pass
    return datetime.fromtimestamp(source.stat().st_mtime).strftime("%Y-%m-%d")


def dataset_id(keyword: str, date: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", keyword.lower()).strip("-")
    if not slug:
        slug = hashlib.sha1(keyword.encode("utf-8")).hexdigest()[:8]
    return f"{date}-{slug}"


def cache_file_for_key(image_key: str) -> Path:
    return IMAGE_CACHE_DIR / (hashlib.sha1(image_key.encode("utf-8")).hexdigest() + ".img")


def fetch_image_bytes(url: str, image_key: str, timeout: int = 12) -> bytes | None:
    IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = cache_file_for_key(image_key)
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return cache_path.read_bytes()
    request = urllib.request.Request(
        str(url),
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "Referer": "https://www.taobao.com/",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = response.read()
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    if not data:
        return None
    cache_path.write_bytes(data)
    return data


def perceptual_hash(image_bytes: bytes) -> int | None:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("L").resize((DCT_SIZE, DCT_SIZE), Image.Resampling.LANCZOS)
    except Exception:
        return None
    pixels = np.asarray(image, dtype=np.float32)
    dct = DCT_MATRIX @ pixels @ DCT_MATRIX.T
    low_freq = dct[:HASH_SIZE, :HASH_SIZE]
    median = float(np.median(low_freq.flatten()[1:]))
    bits = low_freq >= median
    value = 0
    for bit in bits.flatten():
        value = (value << 1) | int(bool(bit))
    return value


def load_phash_cache() -> dict[str, str]:
    if not PHASH_CACHE_PATH.exists():
        return {}
    try:
        return json.loads(PHASH_CACHE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_phash_cache(cache: dict[str, str]) -> None:
    PHASH_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PHASH_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def compute_image_hashes(image_sources: dict[str, str], workers: int = 32) -> dict[str, int]:
    cached = load_phash_cache()
    hashes: dict[str, int] = {}
    missing: dict[str, str] = {}
    for image_key, url in image_sources.items():
        value = cached.get(image_key)
        if value:
            hashes[image_key] = int(value, 16)
        else:
            missing[image_key] = url
    if missing:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(fetch_image_bytes, url, image_key): image_key
                for image_key, url in missing.items()
            }
            completed = 0
            for future in as_completed(futures):
                image_key = futures[future]
                completed += 1
                data = future.result()
                value = perceptual_hash(data) if data else None
                if value is not None:
                    hashes[image_key] = value
                    cached[image_key] = f"{value:016x}"
                if completed % 500 == 0:
                    print(f"phash progress: {completed}/{len(missing)} new images", file=sys.stderr)
        save_phash_cache(cached)
    return hashes


def hamming_distance(a: int, b: int) -> int:
    return int((a ^ b).bit_count())


class UnionFind:
    def __init__(self, values: list[str]):
        self.parent = {value: value for value in values}

    def find(self, value: str) -> str:
        parent = self.parent[value]
        if parent != value:
            self.parent[value] = self.find(parent)
        return self.parent[value]

    def union(self, left: str, right: str) -> None:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def phash_clusters(image_hashes: dict[str, int], threshold: int = PHASH_DISTANCE_THRESHOLD) -> list[list[str]]:
    keys = list(image_hashes)
    uf = UnionFind(keys)
    buckets: dict[int, list[str]] = defaultdict(list)
    for key, value in image_hashes.items():
        buckets[value.bit_count()].append(key)
    bit_counts = sorted(buckets)
    for bit_count in bit_counts:
        candidates = []
        for neighbor_count in range(bit_count - threshold, bit_count + threshold + 1):
            candidates.extend(buckets.get(neighbor_count, []))
        source_keys = buckets[bit_count]
        candidate_set = set(candidates)
        for i, left in enumerate(source_keys):
            left_hash = image_hashes[left]
            for right in candidate_set:
                if right <= left:
                    continue
                if hamming_distance(left_hash, image_hashes[right]) <= threshold:
                    uf.union(left, right)
    clusters: dict[str, list[str]] = defaultdict(list)
    for key in keys:
        clusters[uf.find(key)].append(key)
    return [cluster for cluster in clusters.values() if len(cluster) >= 2]


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


def shop_brand_marker(shop: str) -> str:
    text = str(clean_nan(shop) or "").strip().lower()
    text = re.sub(r"\s+", "", text)
    suffixes = [
        "官方outlets店", "官方旗舰店", "旗舰店", "专卖店", "专营店", "直营店", "折扣店",
        "企业店", "工厂店", "女鞋店", "鞋类旗舰店", "运动旗舰店", "商务旗舰店",
    ]
    for suffix in suffixes:
        if text.endswith(suffix.lower()):
            text = text[: -len(suffix)]
            break
    return text or str(shop)


def brand_marker(title: str, shop: str) -> str:
    return first_brand(title, shop) or shop_brand_marker(shop)


def count_terms(titles: pd.Series, terms: list[str], top_n: int | None = None) -> list[dict]:
    counter = Counter()
    for title in titles.fillna("").astype(str):
        lower = title.lower()
        for term in terms:
            if term.lower() in lower:
                counter[term] += 1
    rows = [{"name": key, "count": value} for key, value in counter.most_common(top_n)]
    return rows


def count_color_groups(titles: pd.Series) -> list[dict]:
    counter = Counter()
    for title in titles.fillna("").astype(str):
        for color, aliases in COLOR_GROUPS:
            if any(alias in title for alias in aliases):
                counter[color] += 1
    return [{"name": key, "count": value} for key, value in counter.most_common()]


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


def representatives_for_canonical_images(group: pd.DataFrame, limit: int = 12, member_limit: int = 8) -> list[dict]:
    reps = []
    for _, img_part in group.groupby("image_key", sort=False):
        img_part = img_part.sort_values(["sales_num", "排名"], ascending=[False, True])
        row = img_part.iloc[0]
        reps.append({
            "image": str(row["主图链接"]),
            "title": str(row["商品标题"]),
            "shop": str(row["店铺"]),
            "price": round(float(row["价格(元)"]), 2),
            "url": str(row["商品链接"]),
            "count": int(len(img_part)),
            "members": [product_record(member) for _, member in img_part.head(member_limit).iterrows()],
        })
    reps.sort(key=lambda item: -item["count"])
    return reps[:limit]


def duplicate_groups(df: pd.DataFrame, top_n: int = 50) -> tuple[list[dict], int, int]:
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
    return groups[:top_n], len(groups), int(sum(group["link_count"] for group in groups))


def duplicate_groups_from_clusters(df: pd.DataFrame, top_n: int = 50) -> tuple[list[dict], int, int]:
    return duplicate_groups(df, top_n)


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
    return tuple(sorted(set(terms)) + [band])


def style_groups(df: pd.DataFrame, top_n: int = 50) -> tuple[list[dict], int]:
    bucket: dict[tuple[str, ...], list[int]] = defaultdict(list)
    for idx, row in df.iterrows():
        signature = style_signature(row)
        if signature:
            bucket[signature].append(idx)
    groups = []
    for _, indexes in bucket.items():
        part = df.loc[indexes]
        if not (2 <= len(part) <= 5) or part["image_key"].nunique() < 2 or part["店铺"].nunique() < 2:
            continue
        brands = sorted({brand for brand in part["brand"].dropna().astype(str) if brand})
        if len(brands) < 2:
            continue
        brand_counts = Counter(part["brand"].dropna().astype(str))
        shop_counts = Counter(part["店铺"].astype(str))
        if brand_counts and max(brand_counts.values()) / len(part) > 0.6:
            continue
        if max(shop_counts.values()) / len(part) > 0.5:
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


def phash_style_groups(df: pd.DataFrame, clusters: list[list[str]], top_n: int = 50) -> tuple[list[dict], int, int]:
    candidates = []
    groups = []
    by_key = {key: part for key, part in df[df["image_key"] != ""].groupby("image_key")}
    for cluster in clusters:
        parts = [by_key[key] for key in cluster if key in by_key]
        if len(parts) < 2:
            continue
        part = pd.concat(parts, ignore_index=False).sort_values(["sales_num", "排名"], ascending=[False, True])
        canonical_count = int(part["image_key"].nunique())
        if canonical_count < 2 or len(part) < 2:
            continue
        candidates.append(part)

        image_link_counts = part.groupby("image_key").size()
        dominant_image_share = float(image_link_counts.max()) / len(part)
        if image_link_counts.max() > 1 and dominant_image_share > MAX_STYLE_DUPLICATE_IMAGE_LINK_SHARE:
            continue

        canonical_rows = []
        for _, img_part in part.groupby("image_key", sort=False):
            canonical_rows.append(img_part.sort_values(["sales_num", "排名"], ascending=[False, True]).iloc[0])
        canonical_part = pd.DataFrame(canonical_rows).sort_values(["sales_num", "排名"], ascending=[False, True])

        marker_counts = Counter(canonical_part["brand_marker"].astype(str))
        known_brands = sorted({brand for brand in canonical_part["brand"].dropna().astype(str) if brand})
        if len(marker_counts) < 2:
            continue
        if max(marker_counts.values()) / len(canonical_part) > 0.8:
            continue

        first = canonical_part.iloc[0]
        shops, shops_total = shop_summary(canonical_part)
        display_brands = known_brands or [marker for marker, _ in marker_counts.most_common(8)]
        reps = representatives_for_canonical_images(part, member_limit=1)
        groups.append({
            "tag": "style",
            "tag_label": "款式撞款",
            "link_count": int(len(part)),
            "style_image_count": canonical_count,
            "duplicate_link_count": int(len(part) - canonical_count),
            "unique_images": canonical_count,
            "shop_count": int(canonical_part["店铺"].nunique()),
            "brand_count": int(len(marker_counts)),
            "brands": display_brands[:8],
            "sample_title": str(first["商品标题"]),
            "sample_shop": str(first["店铺"]),
            "sample_price": round(float(first["价格(元)"]), 2),
            "shops": shops,
            "shops_total": shops_total,
            "representatives": reps,
            "representative": str(first["主图链接"]),
        })
    groups.sort(key=lambda item: (-item["style_image_count"], -item["brand_count"], -item["shop_count"], -item["link_count"]))
    return groups[:top_n], len(groups), len(candidates)


def build_dataset(source: Path) -> dict:
    if not source.exists():
        raise SystemExit(f"Source workbook not found: {source}")

    raw, overview = read_source_workbook(source)

    df = raw.copy()
    df["价格(元)"] = pd.to_numeric(df["价格(元)"], errors="coerce")
    df = df.dropna(subset=["价格(元)", "商品标题", "店铺"]).copy()
    df["sales_num"] = df["销量"].map(parse_sales)
    df["image_key"] = df["主图链接"].fillna("").astype(str).map(normalize_image)
    df["province"] = df["产地"].fillna("").astype(str).map(province)
    df["brand"] = [first_brand(title, shop) for title, shop in zip(df["商品标题"], df["店铺"])]
    df["brand_marker"] = [brand_marker(title, shop) for title, shop in zip(df["商品标题"], df["店铺"])]

    brand_counter = Counter(str(brand) for brand in df["brand"] if pd.notna(brand) and str(brand))
    branded_products = sum(brand_counter.values()) or 1
    brand_rows = [
        {"name": brand, "count": count, "percent": round(count / branded_products * 100, 1)}
        for brand, count in brand_counter.most_common(20)
    ]
    location_rows = [{"location": key, "count": value} for key, value in Counter(df["province"]).most_common(20)]
    color_rows = count_color_groups(df["商品标题"])
    style_rows = count_terms(df["商品标题"], STYLE_TERMS, 15)
    hot_rows = [{"word": row["name"], "count": row["count"]} for row in count_terms(df["商品标题"], HOT_WORDS)]

    dup_groups_rows, dup_total, dup_total_links = duplicate_groups_from_clusters(df)
    style_groups_rows = []
    style_total = 0
    style_candidate_total = 0

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
    keyword = str(overview.get("关键词", infer_keyword_from_filename(source)))
    date = source_date(source, generated)
    data = {
        "id": dataset_id(keyword, date),
        "keyword": keyword,
        "date": date,
        "source_file": source.name,
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
            "analysis_mode": "duplicate_only",
            "total_items": int(len(df)),
            "unique_urls": int(df["主图链接"].fillna("").astype(str).nunique()),
            "unique_canonical_images": int(df["image_key"].nunique()),
            "phash_images": 0,
            "phash_groups": 0,
            "style_candidates": int(style_candidate_total),
            "phash_distance_threshold": PHASH_DISTANCE_THRESHOLD,
            "dup_groups_count": dup_total,
            "style_groups_count": style_total,
            "dup_total_links": dup_total_links,
            "style_total_links": int(sum(group["link_count"] for group in style_groups_rows)),
        },
        "dup_groups": dup_groups_rows,
        "style_groups": style_groups_rows,
        "dup_shops": dup_shop_rows[:10],
    }

    return data


def main() -> None:
    sources = [Path(arg) for arg in sys.argv[1:]] if len(sys.argv) > 1 else SOURCE_PATHS
    datasets = [build_dataset(source) for source in sources]
    default_dataset = datasets[0] if datasets else {}
    output = "const DATASETS=" + json.dumps(datasets, ensure_ascii=False, separators=(",", ":")) + ";\n"
    output += "const D=DATASETS[0];\n"
    OUT_PATH.write_text(output, encoding="utf-8")
    print(json.dumps({
        "output": str(OUT_PATH),
        "datasets": [
            {
                "id": data["id"],
                "keyword": data["keyword"],
                "date": data["date"],
                "products": data["kpi"]["total_products"],
                "shops": data["kpi"]["total_shops"],
                "dup_groups": data["visual_meta"]["dup_groups_count"],
            }
            for data in datasets
        ],
        "default": default_dataset.get("id"),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
