#!/usr/bin/env python3
"""Scarica i dati dalle fonti originali e genera i GeoJSON leggeri in data/.

Uso:  python3 scripts/build_data.py
Richiede: shapely  (pip install shapely)
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data-raw"
OUT = ROOT / "data"

COMUNE = "https://dati.comune.milano.it/dataset"
SOURCES = {
    "fontanelle": f"{COMUNE}/96e339de-d545-4c0a-8ba4-1f0e0f744082/resource/624c5910-1d2c-4595-a398-9f17c59694f7/download/vedovelle_20261025-233003_final.geojson",
    "case_acqua": f"{COMUNE}/f471dff0-d7a6-4616-9d66-b0348064da04/resource/44648c0c-04fe-4a3e-8f61-28a47057162b/download/caseacqua_20261025-233003_final.geojson",
    "impianti": f"{COMUNE}/c613f251-6f66-4320-8cac-6ee08d8fd2ef/resource/6811f693-ee63-41ca-9ff7-ea0464f6d600/download/ds34_impianti_sportivi_final.geojson",
    "confine": f"{COMUNE}/e75d91fa-eca6-4ee5-b96e-08bcdbb8d6f0/resource/f56cb432-83e6-48de-ae30-d39b4be61e85/download/confine_comune_milano_layer_0_confine_comune_milano.geojson",
    "fontane": "https://www.fontanedimilano.it/wp-content/uploads/gpx/fdml.geojson",
}
RIRU = "https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/ReticoloIdrografico_RIRU/MapServer/10/query"
BBOX = (9.04, 45.38, 9.28, 45.54)


def fetch(url, dest):
    if dest.exists():
        return json.loads(dest.read_text())
    print("  ↓", url[:90])
    req = urllib.request.Request(url, headers={"User-Agent": "milano-acque/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    dest.write_bytes(data)
    return json.loads(data)


def fetch_riru():
    dest = RAW / "riru.geojson"
    if dest.exists():
        return json.loads(dest.read_text())
    feats, offset = [], 0
    while True:
        q = urllib.parse.urlencode({
            "geometry": ",".join(map(str, BBOX)),
            "geometryType": "esriGeometryEnvelope", "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
            "outFields": "NOME,TIPO_INFR,NOTE", "outSR": 4326,
            "resultOffset": offset, "resultRecordCount": 1000, "f": "geojson",
        })
        page = fetch(f"{RIRU}?{q}", RAW / f"riru_{offset}.json")
        feats += page["features"]
        if len(page["features"]) < 1000:
            break
        offset += 1000
    fc = {"type": "FeatureCollection", "features": feats}
    dest.write_text(json.dumps(fc))
    return fc


def rnd(geom, nd=5):
    """Arrotonda le coordinate (5 decimali ≈ 1 m)."""
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def point(lon, lat, props):
    return {"type": "Feature", "properties": props,
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}}


def write(name, feats):
    path = OUT / f"{name}.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                               ensure_ascii=False, separators=(",", ":")))
    print(f"  ✓ {name}: {len(feats)} elementi, {path.stat().st_size // 1024} KB")


def titlecase(s):
    s = re.sub(r"\s+", " ", (s or "").strip())
    small = {"di", "del", "della", "dei", "delle", "de", "da", "e", "a", "al", "alla", "in", "c/o"}
    words = s.lower().split(" ")
    return " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))


def build_fontanelle(src):
    return [point(*f["geometry"]["coordinates"][:2], {
        "id": f"v{f['properties']['objectID']}",
        "nil": titlecase(f["properties"].get("NIL")),
        "municipio": f["properties"].get("MUNICIPIO"),
    }) for f in src["features"]]


def build_case(src):
    return [point(*f["geometry"]["coordinates"][:2], {
        "id": f"c{f['properties']['objectID']}",
        "nil": titlecase(f["properties"].get("NIL")),
        "municipio": f["properties"].get("MUNICIPIO"),
    }) for f in src["features"]]


def build_fontane(src):
    out = []
    for f in src["features"]:
        p = f["properties"]
        perc = (p.get("ogr_Percorso") or "").replace("null", "")
        link = re.search(r"href='\.\./([^']+)'", p.get("ogr_Link") or "")
        out.append(point(*f["geometry"]["coordinates"][:2], {
            "id": f"f{p['ogr_id']}",
            "nome": (p.get("ogr_Fontana") or "").strip(),
            "monumentale": "monumentali" in perc,
            "storica": "storiche" in perc,
            "municipio": p.get("ogr_Zona"),
            "url": f"https://www.fontanedimilano.it/{link.group(1)}/" if link else None,
        }))
    return out


SWIM = re.compile(r"nuoto|subacq|piscin|balneare|tuffi|pallanuoto", re.I)


def build_piscine(src):
    """Raggruppa per posizione: lo stesso impianto compare una volta per disciplina."""
    places = {}
    for f in src["features"]:
        p = f["properties"]
        if not SWIM.search(p.get("info") or ""):
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        key = (round(lon, 4), round(lat, 4))
        pl = places.setdefault(key, {"lon": lon, "lat": lat, "nomi": [], "attivita": [],
                                     "indirizzo": p.get("Indirizzo"), "nil": p.get("NIL"), "url": p.get("URL")})
        if p.get("Nome") and p["Nome"] != "NON ATTRIBUITO" and p["Nome"] not in pl["nomi"]:
            pl["nomi"].append(p["Nome"])
        a = (p.get("info") or "").strip()
        if a and a not in pl["attivita"]:
            pl["attivita"].append(a)
    out = []
    for i, pl in enumerate(places.values()):
        out.append(point(pl["lon"], pl["lat"], {
            "id": f"p{i}",
            "nome": titlecase(pl["nomi"][0]) if pl["nomi"] else None,
            "indirizzo": titlecase(pl["indirizzo"]),
            "attivita": ", ".join(a.lower() for a in pl["attivita"]),
            "nil": titlecase(pl["nil"]),
            "url": pl["url"],
        }))
    return out


RIVERS = re.compile(r"olona|lambro|seveso|lura|torrente|fiume|guisa|nirone|garbogera|merlata|pudiga|bozzente", re.I)
CANALS = re.compile(r"redefossi|scolmatore|deviatore|derivatore|villoresi", re.I)


def riru_class(name):
    n = name or ""
    if re.search(r"naviglio", n, re.I):
        return "naviglio"
    if RIVERS.search(n) or CANALS.search(n):
        return "fiume"
    return "roggia"


def build_reticolo(src):
    groups = {"naviglio": [], "fiume": [], "roggia": []}
    for f in src["features"]:
        g = f.get("geometry")
        if not g:
            continue
        name = (f["properties"].get("NOME") or "").strip()
        cls = riru_class(name)
        tol = 0.00001 if cls == "naviglio" else 0.00003
        geom = shape(g).simplify(tol, preserve_topology=False)
        if geom.is_empty:
            continue
        groups[cls].append({"type": "Feature",
                            "properties": {"nome": titlecase(name) if name else None, "classe": cls},
                            "geometry": rnd(mapping(geom))})
    return groups


def build_confine(src):
    g = shape(src["features"][0]["geometry"]).simplify(0.00005)
    return [{"type": "Feature", "properties": {}, "geometry": rnd(mapping(g))}]


def main():
    RAW.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    print("Scarico le fonti…")
    src = {k: fetch(u, RAW / f"{k}.geojson") for k, u in SOURCES.items()}
    riru = fetch_riru()
    print("Genero i layer…")
    write("fontanelle", build_fontanelle(src["fontanelle"]))
    write("case_acqua", build_case(src["case_acqua"]))
    write("fontane", build_fontane(src["fontane"]))
    write("piscine", build_piscine(src["impianti"]))
    for cls, feats in build_reticolo(riru).items():
        write(f"reticolo_{cls}", feats)
    write("confine", build_confine(src["confine"]))


if __name__ == "__main__":
    sys.exit(main())
