from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    style = (ROOT / "assets/style.css").read_text(encoding="utf-8")
    data = (ROOT / "data.js").read_text(encoding="utf-8")
    app = (ROOT / "assets/app.js").read_text(encoding="utf-8")

    html = index
    html = html.replace('  <link rel="stylesheet" href="assets/style.css">\n', f"  <style>\n{style}\n  </style>\n")
    html = html.replace('  <script src="data.js"></script>\n  <script src="assets/app.js"></script>\n', f"  <script>\n{data}\n  </script>\n  <script>\n{app}\n  </script>\n")
    html = html.replace("<title>德训鞋女 · 淘宝市场情报看板</title>", "<title>德训鞋女 · 淘宝市场情报看板（离线版）</title>")

    output = ROOT / "standalone.html"
    output.write_text(html, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
