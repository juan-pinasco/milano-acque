#!/usr/bin/env python3
"""Scarica i dati dalle fonti ufficiali e genera i GeoJSON leggeri in data/.

Solo fonti ufficiali: Comune di Milano (Open Data), Regione Lombardia
(Reticolo Idrografico Regionale Unificato, Database Topografico) e
fontanedimilano.it per le fontane.

I livelli seguono i tre cicli dell'acqua della tesi:
  1. L'acqua del territorio (ciclo aperto): fiumi, fontanili, navigli e rogge
  2. L'acqua contenuta (ciclo chiuso): laghetti e cave, fontane, piscine
  3. L'acqua di consumo (ciclo integrato): case dell'acqua, vedovelle

Uso:  python3 scripts/build_data.py
Richiede: shapely, pyproj  (pip install shapely pyproj)
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Geod
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data-raw"
OUT = ROOT / "data"

COMUNE = "https://dati.comune.milano.it/dataset"
SOURCES = {
    "fontanelle": f"{COMUNE}/96e339de-d545-4c0a-8ba4-1f0e0f744082/resource/624c5910-1d2c-4595-a398-9f17c59694f7/download/vedovelle_20261025-233003_final.geojson",
    "case_acqua": f"{COMUNE}/f471dff0-d7a6-4616-9d66-b0348064da04/resource/44648c0c-04fe-4a3e-8f61-28a47057162b/download/caseacqua_20261025-233003_final.geojson",
    "impianti": f"{COMUNE}/c613f251-6f66-4320-8cac-6ee08d8fd2ef/resource/6811f693-ee63-41ca-9ff7-ea0464f6d600/download/ds34_impianti_sportivi_final.geojson",
    "balneari": f"{COMUNE}/6b050080-317b-4bcd-8ae9-22f9cd781c13/resource/b454cce0-3db1-4dbd-94bf-d94d736d9e2a/download/centri_balneari_milano__final.geojson",
    "parchi": f"{COMUNE}/8920bbea-fe1a-4061-8c6e-0746d95316c1/resource/7cba11e7-c236-49a7-aef4-4db6329eec5d/download/parchi.geojson",
    "confine": f"{COMUNE}/e75d91fa-eca6-4ee5-b96e-08bcdbb8d6f0/resource/f56cb432-83e6-48de-ae30-d39b4be61e85/download/confine_comune_milano_layer_0_confine_comune_milano.geojson",
    "fontane": "https://www.fontanedimilano.it/wp-content/uploads/gpx/fdml.geojson",
}
LOMBARDIA = "https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio"
# Reticolo Idrografico Regionale Unificato, classificazione della D.g.r. XII/3668 del 2024
RIRU = {
    "rip_aipo": f"{LOMBARDIA}/ReticoloIdrografico_RIRU/MapServer/2",  # Reticolo Idrico Principale (AIPO)
    "rip": f"{LOMBARDIA}/ReticoloIdrografico_RIRU/MapServer/3",       # Reticolo Idrico Principale
    "rib": f"{LOMBARDIA}/ReticoloIdrografico_RIRU/MapServer/8",       # Reticolo Idrico di Bonifica (navigli inclusi)
    "rim": f"{LOMBARDIA}/ReticoloIdrografico_RIRU/MapServer/7",       # Reticolo Idrico Minore
}
# Database Topografico regionale: specchi d'acqua
SPECCHI = f"{LOMBARDIA}/LOM_WMS4_Idrografia/MapServer/3"
AREA = (8.98, 45.34, 9.4, 45.57)  # stessa area della mappa (AREA in js/app.js)

# Le 8 piscine comunali all'aperto e il loro stato nell'estate 2026 (informazione della tesi).
# Chiave: DENOMINAZIONE nel dataset dei centri balneari; Fossati è negli impianti sportivi.
PISCINE = {
    "ROMANO": ("Piscina Guido Romano", "attiva"),
    "SANT'ABBONDIO": ("Piscina Sant'Abbondio", "attiva"),
    "CARDELLINO": ("Piscina Cardellino", "attiva"),
    "LIDO": ("Lido di Milano", "chiusa"),
    "ARGELATI": ("Piscina Argelati", "chiusa"),
    "SCARIONI": ("Piscina Scarioni", "chiusa"),
    "PROCIDA": ("Piscina Procida", "chiusa"),
}
FOSSATI = ("Piscina Cambini Fossati", "chiusa")

FONTANILE = re.compile(r"fontanil", re.I)
GEOD = Geod(ellps="WGS84")


def fetch(url, dest):
    if dest.exists():
        return json.loads(dest.read_text())
    print("  ↓", url[:90])
    req = urllib.request.Request(url, headers={"User-Agent": "milano-acque/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    dest.write_bytes(data)
    return json.loads(data)


def fetch_arcgis(layer_url, name):
    """Tutti gli elementi di un layer ArcGIS nell'area della mappa, a pagine."""
    dest = RAW / f"{name}.geojson"
    if dest.exists():
        return json.loads(dest.read_text())
    feats, offset = [], 0
    while True:
        q = urllib.parse.urlencode({
            "geometry": ",".join(map(str, AREA)), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects", "where": "1=1", "outFields": "*", "outSR": 4326,
            "resultOffset": offset, "resultRecordCount": 1000, "f": "geojson",
        })
        page = fetch(f"{layer_url}/query?{q}", RAW / f"{name}_{offset}.json")
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


def feature(geom, props, tol=0.00002):
    g = geom.simplify(tol, preserve_topology=True)
    return None if g.is_empty else {"type": "Feature", "properties": props, "geometry": rnd(mapping(g))}


def write(name, feats):
    feats = [f for f in feats if f]
    path = OUT / f"{name}.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                               ensure_ascii=False, separators=(",", ":")))
    print(f"  ✓ {name}: {len(feats)} elementi, {path.stat().st_size // 1024} KB")


def titlecase(s):
    s = re.sub(r"\s+", " ", (s or "").strip())
    small = {"di", "del", "della", "dei", "delle", "de", "da", "e", "a", "al", "alla", "in", "o", "c/o"}
    words = s.lower().split(" ")
    return " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))


# ---------- 1. l'acqua del territorio ----------

def build_fiumi(rip_aipo, rip):
    out = []
    for f in rip_aipo["features"]:
        out.append(feature(shape(f["geometry"]), {"nome": titlecase(f["properties"]["NOME"]), "rete": "RIP"}))
    for f in rip["features"]:
        p = f["properties"]
        nome = (p.get("NOME_PRINCIPALE_CORSO_ACQUA") or "").strip()
        tipo = (p.get("TIPOLOGIA_CORSO_ACQUA") or "").strip("() ")
        if tipo and not nome.lower().startswith(tipo.lower()):
            nome = f"{tipo} {nome}"
        out.append(feature(shape(f["geometry"]), {"nome": titlecase(nome), "rete": "RIP"}))
    return out


def build_canali_e_fontanili(rib, rim):
    """Navigli e rogge (RIB + RIM); i fontanili, riconoscibili dal nome, vanno a parte."""
    canali, fontanili = [], []
    for fc, rete, key in ((rib, "RIB", "NOME_C_ACQ"), (rim, "RIM", "NOME_RIM")):
        for f in fc["features"]:
            if not f.get("geometry"):
                continue
            nome = (f["properties"].get(key) or "").strip()
            props = {"nome": titlecase(nome) or None, "rete": rete}
            if FONTANILE.search(nome):
                fontanili.append(feature(shape(f["geometry"]), props))
            else:
                props["naviglio"] = bool(re.search(r"naviglio", nome, re.I))
                canali.append(feature(shape(f["geometry"]), props, 0.00001 if props["naviglio"] else 0.00002))
    return canali, fontanili


# ---------- 2. l'acqua contenuta ----------

def lake_name(raw):
    """Il DBT scrive "Malaspina (Lago)", "Di Redecesio (Laghetto)": si legge "Lago Malaspina"."""
    raw = (raw or "").strip()
    m = re.match(r"(.*?)\s*\((.*?)\)$", raw)
    if not m:
        return raw or None
    base, tipo = m.group(1).strip(), re.sub(r"\s+di$", "", m.group(2).strip())
    if base.lower() == "idroscalo":
        return "Idroscalo"
    base = re.sub(r"^Di ", "di ", base)
    return f"{tipo} {base}"


def build_laghi(specchi, parchi, confine):
    """Specchi d'acqua del DBT regionale: quelli nel Comune (più di 2000 m²) e quelli con un nome.
    Se il DBT non dà un nome, si usa il parco comunale in cui si trovano."""
    comune = shape(confine["features"][0]["geometry"])
    parks = [(shape(f["geometry"]), titlecase(f["properties"]["PARCO"])) for f in parchi["features"]
             if f.get("geometry") and f["properties"].get("PARCO")]
    out = []
    for f in specchi["features"]:
        g = shape(f["geometry"])
        area = abs(GEOD.geometry_area_perimeter(g)[0])
        nome = lake_name(f["properties"].get("SP_ACQ_NOM"))
        if not nome and (area < 2000 or not comune.intersects(g)):
            continue
        parco = next((n for pg, n in parks if pg.intersects(g)), None)
        out.append(feature(g, {"nome": nome, "parco": parco, "area_mq": round(area)}, 0.00001))
    return out


def build_piscine(balneari, impianti):
    out, seen = [], set()
    for f in balneari["features"]:
        p = f["properties"]
        key = p["DENOMINAZIONE"].strip()
        if key in PISCINE and key not in seen:
            seen.add(key)
            nome, stato = PISCINE[key]
            out.append(point(*f["geometry"]["coordinates"][:2], {
                "id": f"p{len(out)}", "nome": nome, "stato": stato,
                "indirizzo": titlecase(p.get("INDIRIZZO")), "nil": titlecase(p.get("NIL"))}))
    missing = set(PISCINE) - seen
    if missing:
        print("  ! piscine non trovate:", missing)
    fossati = next(f for f in impianti["features"]
                   if "FOSSATI" in (f["properties"].get("Nome") or "") and "NUOTO" in (f["properties"].get("info") or ""))
    out.append(point(*fossati["geometry"]["coordinates"][:2], {
        "id": f"p{len(out)}", "nome": FOSSATI[0], "stato": FOSSATI[1],
        "indirizzo": titlecase(fossati["properties"].get("Indirizzo")), "nil": titlecase(fossati["properties"].get("NIL"))}))
    return out


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


# ---------- 3. l'acqua di consumo ----------

def build_punti(src, prefix):
    return [point(*f["geometry"]["coordinates"][:2], {
        "id": f"{prefix}{f['properties']['objectID']}",
        "nil": titlecase(f["properties"].get("NIL")),
        "municipio": f["properties"].get("MUNICIPIO"),
    }) for f in src["features"]]


def build_confine(src):
    g = shape(src["features"][0]["geometry"]).simplify(0.00005)
    return [{"type": "Feature", "properties": {}, "geometry": rnd(mapping(g))}]


def main():
    RAW.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    print("Scarico le fonti…")
    src = {k: fetch(u, RAW / f"{k}.geojson") for k, u in SOURCES.items()}
    riru = {k: fetch_arcgis(u, f"riru_{k}") for k, u in RIRU.items()}
    specchi = fetch_arcgis(SPECCHI, "dbt_specchi")

    print("Genero i layer…")
    write("fiumi", build_fiumi(riru["rip_aipo"], riru["rip"]))
    canali, fontanili = build_canali_e_fontanili(riru["rib"], riru["rim"])
    write("fontanili", fontanili)
    write("canali", canali)
    write("laghi", build_laghi(specchi, src["parchi"], src["confine"]))
    write("fontane", build_fontane(src["fontane"]))
    write("piscine", build_piscine(src["balneari"], src["impianti"]))
    write("case_acqua", build_punti(src["case_acqua"], "c"))
    write("fontanelle", build_punti(src["fontanelle"], "v"))
    write("confine", build_confine(src["confine"]))
    # i file della versione precedente non servono più
    for old in ("reticolo_naviglio", "reticolo_fiume", "reticolo_roggia"):
        (OUT / f"{old}.geojson").unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
