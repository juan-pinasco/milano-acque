// Stile della mappa di base: immagine satellitare in bianco e nero, scurita e
// velata di blu petrolio; sopra, le strade come fili celesti appena visibili,
// così che l'unica luce sia l'acqua. Strade ed etichette: OpenStreetMap (OpenFreeMap).

export const NIGHT = {
  bg: "#03121a",          // sotto il satellite, dove l'immagine non arriva
  tint: "#0a4257",        // velo blu petrolio sopra il satellite
  mask: "#020b10",        // fuori dal Comune
  street: "#6fd6f2",      // fili delle strade
  label: "#9cc3cf",
  labelDim: "#6f97a4",
  halo: "#03121a",
  water: "#1b6f8f",
};
const lines = (filter) => ["all", ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false], filter];
const polys = (filter) => ["all", ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false], filter];

const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
const SAT_ATTRIBUTION = 'Immagini © <a href="https://www.esri.com" target="_blank">Esri</a>, Maxar, Earthstar Geographics';
const SAT_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// Nella versione "impacchettata" (scripts/build_artifact.py) i tasselli della mappa
// e i caratteri delle etichette viaggiano insieme alla pagina invece di arrivare da OpenFreeMap.
export const LOCAL_BASEMAP = typeof window !== "undefined" && window.ACQUE_LOCAL_BASEMAP;

// Nella versione impacchettata il satellite è Sentinel-2 (EOX, CC BY-NC-SA 4.0), che si può
// ridistribuire per usi non commerciali; le immagini Esri si usano solo collegandosi al loro servizio.
const S2_ATTRIBUTION = '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)';

function sources() {
  if (!LOCAL_BASEMAP) {
    return {
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: ATTRIBUTION },
      sat: { type: "raster", tiles: [SAT_TILES], tileSize: 256, maxzoom: 19, attribution: SAT_ATTRIBUTION },
    };
  }
  const { bounds, maxzoom, satMaxzoom } = LOCAL_BASEMAP;
  return {
    glyphs: "acque://fonts/{fontstack}/{range}",
    omt: { type: "vector", tiles: ["acque://tiles/{z}/{x}/{y}"], minzoom: 10, maxzoom, bounds, attribution: ATTRIBUTION },
    sat: { type: "raster", tiles: ["acque-sat://{z}/{x}/{y}"], tileSize: 256, minzoom: 10, maxzoom: satMaxzoom, bounds, attribution: S2_ATTRIBUTION },
  };
}

// claude.ai non serve file .pbf: i tasselli e i caratteri viaggiano come testo base64
// (tiles/z/x/y.txt, fonts/Noto-Sans-Regular/0-255.txt) e qui tornano binari.
export function registerLocalBasemap(maplibregl) {
  if (!LOCAL_BASEMAP) return;
  const here = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
  // satellite: un file JSON per colonna (sat/z/x.json, { y: base64 }) per restare sotto il limite di file
  const columns = new Map();
  maplibregl.addProtocol("acque-sat", async (params) => {
    const [z, x, y] = params.url.replace("acque-sat://", "").split("/");
    const key = `${z}/${x}`;
    if (!columns.has(key)) columns.set(key, fetch(`${here}sat/${key}.json`).then((r) => (r.ok ? r.json() : {})));
    const b64 = (await columns.get(key))[y];
    if (!b64) throw new Error(`sat ${params.url}: assente`);
    return { data: fromBase64(b64) };
  });
  maplibregl.addProtocol("acque", async (params, abort) => {
    const path = params.url.replace("acque://", "").replace(/%20| /g, "-");
    const res = await fetch(`${here}${path}.txt`, { signal: abort.signal });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return { data: fromBase64((await res.text()).trim()) };
  });
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// spessore delle strade per zoom, secondo la loro importanza: [principali, medie, minori]
const byClass = ([major, mid, minor]) => ["match", ["get", "class"], ["motorway", "trunk", "primary"], major, ["secondary", "tertiary"], mid, minor];
const roadWidth = ["interpolate", ["exponential", 1.6], ["zoom"],
  10, byClass([0.6, 0.4, 0.2]), 14, byClass([1.4, 1, 0.6]), 18, byClass([3, 2.2, 1.4])];

export function baseStyle() {
  const N = NIGHT;
  const { glyphs, omt, sat } = sources();
  return {
    version: 8,
    glyphs,
    sources: {
      omt,
      sat,
      // un rettangolo sul mondo intero per il velo colorato
      tint: { type: "geojson", data: { type: "Feature", properties: {},
        geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": N.bg } },
      { id: "satellite", type: "raster", source: "sat",
        paint: { "raster-saturation": -1, "raster-contrast": 0.12, "raster-brightness-max": 0.62, "raster-fade-duration": 200 } },
      { id: "sat-tint", type: "fill", source: "tint",
        paint: { "fill-color": N.tint, "fill-opacity": 0.55 } },
      { id: "base-water", type: "fill", source: "omt", "source-layer": "water",
        filter: polys(["!=", ["get", "brunnel"], "tunnel"]), paint: { "fill-color": N.water, "fill-opacity": 0.45 } },
      { id: "base-waterway", type: "line", source: "omt", "source-layer": "waterway",
        filter: lines(["!=", ["get", "brunnel"], "tunnel"]),
        paint: { "line-color": N.water, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 1.6] } },
      { id: "rail", type: "line", source: "omt", "source-layer": "transportation",
        filter: lines(["==", ["get", "class"], "rail"]),
        paint: { "line-color": N.street, "line-opacity": 0.14,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 1.2], "line-dasharray": [3, 2] } },
      { id: "road", type: "line", source: "omt", "source-layer": "transportation",
        filter: lines(["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"], true, false]),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": N.street,
          "line-opacity": ["match", ["get", "class"], ["motorway", "trunk", "primary"], 0.42, ["secondary", "tertiary"], 0.3, 0.16],
          "line-width": roadWidth } },
      { id: "road-label", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14.5,
        filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "minor"], true, false],
        layout: { "symbol-placement": "line", "text-field": ["coalesce", ["get", "name:it"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9.5, 18, 12], "text-letter-spacing": 0.02 },
        paint: { "text-color": N.labelDim, "text-halo-color": N.halo, "text-halo-width": 1.4 } },
      { id: "place-label", type: "symbol", source: "omt", "source-layer": "place", minzoom: 11.5,
        filter: ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood"], true, false],
        layout: { "text-field": ["upcase", ["coalesce", ["get", "name:it"], ["get", "name"]]],
          "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12, 9, 16, 12],
          "text-letter-spacing": 0.14, "text-max-width": 8 },
        paint: { "text-color": N.label, "text-halo-color": N.halo, "text-halo-width": 1.4, "text-opacity": 0.8 } },
      { id: "town-label", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 13,
        filter: ["match", ["get", "class"], ["town", "village"], true, false],
        layout: { "text-field": ["coalesce", ["get", "name:it"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 11 },
        paint: { "text-color": N.label, "text-halo-color": N.halo, "text-halo-width": 1.4 } },
    ],
  };
}
