// Configurazione dei livelli tematici.
// Per aggiungere un livello: mettere il GeoJSON in data/, aggiungere una voce
// qui sotto e i testi "layer.<id>" / "desc.<id>" in i18n.js.

export const COLORS = {
  navigli: "#1c4f8a",
  fiumi: "#3b78b8",
  rogge: "#7aa9cf",
  memoria: "#1c4f8a",
  nascosta: "#4f86bd",
  vedovelle: "#2d6a47",
  case: "#0f9488",
  fontane: "#b07d2a",
  piscine: "#2f9bd6",
  deriva: "#e0452b",
};

export const GROUPS = ["visibile", "pubblica", "corpo", "invisibile"];

const zw = (a, b) => ["interpolate", ["exponential", 1.4], ["zoom"], 10, a, 16, b];

export const LAYERS = [
  {
    id: "navigli", group: "visibile", swatch: "line", data: "data/reticolo_naviglio.geojson", visible: true,
    mapLayers: [
      { id: "navigli-halo", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": zw(4, 12), "line-opacity": 0.7 } },
      { id: "navigli", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.navigli, "line-width": zw(2, 7) } },
      { id: "navigli-label", type: "symbol", minzoom: 12,
        layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 14], "symbol-spacing": 400, "text-offset": [0, -1.1] },
        paint: { "text-color": COLORS.navigli, "text-halo-color": "#f3efe6", "text-halo-width": 2 } },
    ],
  },
  {
    id: "fiumi", group: "visibile", swatch: "line", data: "data/reticolo_fiume.geojson", visible: true,
    mapLayers: [
      { id: "fiumi", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fiumi, "line-width": zw(1.1, 3.4), "line-opacity": 0.9 } },
      { id: "fiumi-label", type: "symbol", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"], "text-size": 11, "symbol-spacing": 350, "text-offset": [0, -0.9] },
        paint: { "text-color": COLORS.fiumi, "text-halo-color": "#f3efe6", "text-halo-width": 1.8 } },
    ],
  },
  {
    id: "rogge", group: "visibile", swatch: "line-thin", data: "data/reticolo_roggia.geojson", visible: true,
    mapLayers: [
      { id: "rogge", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.rogge, "line-width": zw(0.5, 2), "line-opacity": 0.75 } },
      { id: "rogge-label", type: "symbol", minzoom: 14.5,
        layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"], "text-size": 10, "symbol-spacing": 300, "text-offset": [0, -0.8] },
        paint: { "text-color": COLORS.fiumi, "text-halo-color": "#f3efe6", "text-halo-width": 1.6 } },
    ],
  },
  {
    id: "fontane", group: "visibile", swatch: "icon", icon: "fontana", data: "data/fontane.geojson", visible: true,
    mapLayers: [
      { id: "fontane", type: "symbol", interactive: true,
        layout: { "icon-image": "fontana", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 15, 1],
          "icon-allow-overlap": true, "icon-padding": 0 } },
    ],
  },
  {
    id: "vedovelle", group: "pubblica", swatch: "dot", data: "data/fontanelle.geojson", visible: true,
    mapLayers: [
      { id: "vedovelle", type: "circle", interactive: true,
        paint: { "circle-color": COLORS.vedovelle, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 13, 3.2, 16, 6],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 15, 1.6] } },
    ],
  },
  {
    id: "case", group: "pubblica", swatch: "icon", icon: "casa", data: "data/case_acqua.geojson", visible: true,
    mapLayers: [
      { id: "case", type: "symbol", interactive: true,
        layout: { "icon-image": "casa", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 15, 1], "icon-allow-overlap": true } },
    ],
  },
  {
    id: "piscine", group: "corpo", swatch: "icon", icon: "piscina", data: "data/piscine.geojson", visible: true,
    mapLayers: [
      { id: "piscine", type: "symbol", interactive: true,
        layout: { "icon-image": "piscina", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 15, 1.05], "icon-allow-overlap": true } },
    ],
  },
  {
    id: "memoria", group: "invisibile", swatch: "line-dash", data: "data/memoria.geojson", visible: true,
    mapLayers: [
      { id: "memoria-halo", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.memoria, "line-width": zw(5, 22), "line-opacity": 0.1, "line-blur": 2 } },
      { id: "memoria", type: "line", interactive: true, layout: { "line-join": "round" },
        paint: { "line-color": COLORS.memoria, "line-width": zw(1.6, 4), "line-dasharray": [1.6, 1.4] } },
      { id: "memoria-label", type: "symbol", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["concat", ["get", "nome"], "  ·  ", ["get", "anno"]],
          "text-font": ["Noto Sans Italic"], "text-size": 11.5, "symbol-spacing": 500, "text-offset": [0, -1.2], "text-letter-spacing": 0.03 },
        paint: { "text-color": COLORS.memoria, "text-halo-color": "#f3efe6", "text-halo-width": 2 } },
    ],
  },
  {
    // Dai dati di base OpenStreetMap: i corsi d'acqua marcati come "tunnel".
    id: "nascosta", group: "invisibile", swatch: "line-dot", source: "omt", visible: false,
    mapLayers: [
      { id: "nascosta-glow", type: "line", "source-layer": "waterway",
        filter: ["==", ["get", "brunnel"], "tunnel"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.nascosta, "line-width": zw(6, 18), "line-opacity": 0.16, "line-blur": 4 } },
      { id: "nascosta", type: "line", interactive: true, "source-layer": "waterway",
        filter: ["==", ["get", "brunnel"], "tunnel"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.navigli, "line-width": zw(1.8, 4), "line-dasharray": [0.4, 1.8] } },
    ],
  },
];

// Icone disegnate in SVG e registrate nella mappa (a 2x per gli schermi retina).
const ICON_SVG = {
  fontana: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="22" fill="${COLORS.fontane}" stroke="#fff" stroke-width="4"/>
    <g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">
      <path d="M28 34 V20"/><path d="M28 21 C 22 17, 18 22, 18 28"/><path d="M28 21 C 34 17, 38 22, 38 28"/>
      <path d="M17 35 H39"/></g></svg>`,
  casa: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <rect x="7" y="7" width="42" height="42" rx="11" fill="${COLORS.case}" stroke="#fff" stroke-width="4"/>
    <path d="M28 15 C 23 23, 20 27, 20 31.5 A 8 8 0 0 0 36 31.5 C 36 27, 33 23, 28 15 Z" fill="#fff"/>
    <circle cx="25" cy="31" r="1.6" fill="${COLORS.case}"/><circle cx="30" cy="34" r="1.2" fill="${COLORS.case}"/></svg>`,
  piscina: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="22" fill="${COLORS.piscine}" stroke="#fff" stroke-width="4"/>
    <g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">
      <path d="M16 24 q3 -3 6 0 t6 0 t6 0 t6 0"/><path d="M16 31 q3 -3 6 0 t6 0 t6 0 t6 0"/><path d="M16 38 q3 -3 6 0 t6 0 t6 0 t6 0"/></g></svg>`,
  arrow: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <path d="M8 34 L22 8 L36 34 L22 27 Z" fill="${COLORS.deriva}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
};

export function iconSvg(name) {
  return ICON_SVG[name];
}

export function loadIcons(map) {
  return Promise.all(Object.entries(ICON_SVG).map(([name, svg]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 }); resolve(); };
    img.onerror = resolve;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  })));
}
