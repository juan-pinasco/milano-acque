#!/usr/bin/env python3
"""Prepara una versione "impacchettata" del sito in dist-artifact/.

Le pagine di claude.ai (Artifact) non possono caricare risorse da altri siti,
tranne gli script delle CDN e Google Fonts. Questo script scarica i tasselli
della mappa di base (OpenFreeMap) per l'area di Milano, i caratteri delle
etichette e il foglio di stile di MapLibre, e li mette accanto alla pagina.

Uso:  python3 scripts/build_artifact.py
I tasselli scaricati restano in dist-artifact/ come cache: per riscaricarli,
cancellare la cartella.
"""
import base64
import json
import math
import re
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist-artifact"

# Stessa area di AREA in js/app.js
BOUNDS = (8.98, 45.34, 9.4, 45.57)
ZOOMS = range(10, 14)  # oltre lo zoom 13 la mappa ingrandisce i tasselli del 13
# Satellite Sentinel-2 cloudless 2020 (EOX, CC BY-NC-SA 4.0): risoluzione 10 m, utile fino allo zoom 14
SAT_ZOOMS = range(10, 15)
SAT_TILES = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
FONTS = ("Noto Sans Regular", "Noto Sans Italic", "Noto Sans Bold")
GLYPH_RANGES = ("0-255", "256-511", "8192-8447")
MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
SITE_FILES = ["css/style.css", "js/app.js", "js/basemap.js", "js/deriva.js", "js/i18n.js", "js/layers.js"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "milano-acque/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fetch_to(url, dest):
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(get(url))


def fetch_b64(url, dest):
    """claude.ai non serve .pbf: i file binari della mappa si salvano come testo base64."""
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(base64.b64encode(get(url)).decode())


def tile_range(z):
    w, s, e, n = BOUNDS
    def xy(lon, lat):
        k = 2 ** z
        x = int((lon + 180) / 360 * k)
        y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * k)
        return x, y
    (x0, y0), (x1, y1) = xy(w, n), xy(e, s)
    return [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


def strip_versions(text):
    return re.sub(r"\?v=\d+", "", text)


def build_index():
    """index.html senza doctype/html/head/body (li aggiunge claude.ai) e con risorse locali."""
    html = (ROOT / "index.html").read_text()
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body[^>]*>(.*?)</body>", html, re.S).group(1)
    head = re.sub(r'\s*<meta charset[^>]*>|\s*<meta name="viewport"[^>]*>', "", head)
    head = head.replace(MAPLIBRE_CSS, "css/maplibre-gl.css")
    flag = (f"<script>window.ACQUE_LOCAL_BASEMAP = {{ bounds: {json.dumps(list(BOUNDS))}, "
            f"maxzoom: {max(ZOOMS)}, satMaxzoom: {max(SAT_ZOOMS)} }};</script>")
    body = body.replace('<script type="module"', f'{flag}\n  <script type="module"')
    return strip_versions(head.strip() + "\n" + body.strip() + "\n")


def main():
    OUT.mkdir(exist_ok=True)
    for old in OUT.rglob("*.pbf"):
        old.unlink()

    print("Pagina e codice…")
    (OUT / "index.html").write_text(build_index())
    for f in SITE_FILES:
        dest = OUT / f
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(strip_versions((ROOT / f).read_text()))
    shutil.copytree(ROOT / "data", OUT / "data", dirs_exist_ok=True)
    fetch_to(MAPLIBRE_CSS, OUT / "css/maplibre-gl.css")

    print("Caratteri delle etichette…")
    for font in FONTS:
        for rng in GLYPH_RANGES:
            url = f"https://tiles.openfreemap.org/fonts/{font.replace(' ', '%20')}/{rng}.pbf"
            fetch_b64(url, OUT / "fonts" / font.replace(" ", "-") / f"{rng}.txt")

    print("Tasselli della mappa di base…")
    template = json.loads(get("https://tiles.openfreemap.org/planet"))["tiles"][0]
    n = 0
    for z in ZOOMS:
        for x, y in tile_range(z):
            url = template.replace("{z}", str(z)).replace("{x}", str(x)).replace("{y}", str(y))
            fetch_b64(url, OUT / "tiles" / str(z) / str(x) / f"{y}.txt")
            n += 1
    print("Immagini satellitari (Sentinel-2)…")
    cache = OUT / ".cache" / "sat"
    for z in SAT_ZOOMS:
        cols = {}
        for x, y in tile_range(z):
            img = cache / str(z) / str(x) / f"{y}.jpg"
            fetch_to(SAT_TILES.replace("{z}", str(z)).replace("{x}", str(x)).replace("{y}", str(y)), img)
            cols.setdefault(x, {})[str(y)] = base64.b64encode(img.read_bytes()).decode()
        for x, col in cols.items():
            dest = OUT / "sat" / str(z) / f"{x}.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(col))
    published = [p for p in OUT.rglob("*") if p.is_file() and ".cache" not in p.parts]
    size = sum(p.stat().st_size for p in published)
    files = len(published)
    print(f"  ✓ {n} tasselli · {files} file in tutto · {size / 1e6:.1f} MB")
    # elenco dei file da pubblicare accanto alla pagina
    listing = sorted(str(f.relative_to(OUT)) for f in published if f.name not in ("index.html", "files.json"))
    (OUT / "files.json").write_text(json.dumps([{"path": f} for f in listing]))


if __name__ == "__main__":
    sys.exit(main())
