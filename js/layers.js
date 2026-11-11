// Configurazione dei livelli tematici.
// Per aggiungere un livello: mettere il GeoJSON in data/, aggiungere una voce
// qui sotto e i testi "layer.<id>" / "desc.<id>" in i18n.js.

// Colori luminosi su fondo notturno: l'acqua corrente in celeste, ogni tipo di punto con la sua luce.
export const COLORS = {
  navigli: "#5fd8ff",
  fiumi: "#3fb0e0",
  rogge: "#2f8fbc",
  memoria: "#a8ecff",
  nascosta: "#7fe0ff",
  vedovelle: "#6ff0b4",
  case: "#35e6d2",
  fontane: "#ffc860",
  piscine: "#9db0ff",
  deriva: "#ff6b4a",
};
// contorno scuro dei simboli e alone delle etichette
const DARK = "#03121a";

export const GROUPS = ["visibile", "pubblica", "corpo", "invisibile"];

const zw = (a, b) => ["interpolate", ["exponential", 1.4], ["zoom"], 10, a, 16, b];
// alone luminoso sotto i punti
const glow = (id, r0, r1) => ({ id: `${id}-glow`, type: "circle",
  paint: { "circle-color": COLORS[id], "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, r0, 15, r1],
    "circle-opacity": 0.28, "circle-blur": 1 } });
const label = (color, extra = {}) => ({ "text-color": color, "text-halo-color": DARK, "text-halo-width": 1.6, ...extra });

export const LAYERS = [
  {
    id: "navigli", group: "visibile", swatch: "line", data: "data/reticolo_naviglio.geojson", visible: true,
    mapLayers: [
      { id: "navigli-glow", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.navigli, "line-width": zw(8, 26), "line-opacity": 0.22, "line-blur": zw(4, 12) } },
      { id: "navigli", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.navigli, "line-width": zw(1.8, 5) } },
      { id: "navigli-label", type: "symbol", minzoom: 12,
        layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 14], "symbol-spacing": 400, "text-offset": [0, -1.2] },
        paint: label(COLORS.navigli, { "text-halo-width": 2 }) },
    ],
  },
  {
    id: "fiumi", group: "visibile", swatch: "line", data: "data/reticolo_fiume.geojson", visible: true,
    mapLayers: [
      { id: "fiumi-glow", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fiumi, "line-width": zw(5, 14), "line-opacity": 0.16, "line-blur": zw(3, 8) } },
      { id: "fiumi", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fiumi, "line-width": zw(1, 3), "line-opacity": 0.95 } },
      { id: "fiumi-label", type: "symbol", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"], "text-size": 11, "symbol-spacing": 350, "text-offset": [0, -0.9] },
        paint: label(COLORS.fiumi) },
    ],
  },
  {
    id: "rogge", group: "visibile", swatch: "line-thin", data: "data/reticolo_roggia.geojson", visible: true,
    mapLayers: [
      { id: "rogge", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.rogge, "line-width": zw(0.5, 1.8), "line-opacity": 0.7 } },
      { id: "rogge-label", type: "symbol", minzoom: 14.5,
        layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"], "text-size": 10, "symbol-spacing": 300, "text-offset": [0, -0.8] },
        paint: label(COLORS.fiumi) },
    ],
  },
  {
    id: "fontane", group: "visibile", swatch: "icon", icon: "fontana", data: "data/fontane.geojson", visible: true,
    mapLayers: [
      glow("fontane", 8, 18),
      { id: "fontane", type: "symbol", interactive: true,
        layout: { "icon-image": "fontana", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 15, 1],
          "icon-allow-overlap": true, "icon-padding": 0 } },
    ],
  },
  {
    id: "vedovelle", group: "pubblica", swatch: "dot", data: "data/fontanelle.geojson", visible: true,
    mapLayers: [
      { id: "vedovelle-glow", type: "circle",
        paint: { "circle-color": COLORS.vedovelle, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 13, 6, 16, 12],
          "circle-opacity": 0.22, "circle-blur": 1 } },
      { id: "vedovelle", type: "circle", interactive: true,
        paint: { "circle-color": COLORS.vedovelle, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 13, 2.8, 16, 5.5],
          "circle-stroke-color": DARK, "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0.3, 15, 1.2] } },
    ],
  },
  {
    id: "case", group: "pubblica", swatch: "icon", icon: "casa", data: "data/case_acqua.geojson", visible: true,
    mapLayers: [
      glow("case", 8, 18),
      { id: "case", type: "symbol", interactive: true,
        layout: { "icon-image": "casa", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 15, 1], "icon-allow-overlap": true } },
    ],
  },
  {
    id: "piscine", group: "corpo", swatch: "icon", icon: "piscina", data: "data/piscine.geojson", visible: true,
    mapLayers: [
      glow("piscine", 9, 19),
      { id: "piscine", type: "symbol", interactive: true,
        layout: { "icon-image": "piscina", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 15, 1.05], "icon-allow-overlap": true } },
    ],
  },
  {
    id: "memoria", group: "invisibile", swatch: "line-dash", data: "data/memoria.geojson", visible: true,
    mapLayers: [
      { id: "memoria-halo", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.memoria, "line-width": zw(6, 24), "line-opacity": 0.14, "line-blur": zw(3, 10) } },
      { id: "memoria", type: "line", interactive: true, layout: { "line-join": "round" },
        paint: { "line-color": COLORS.memoria, "line-width": zw(1.4, 3.4), "line-dasharray": [1.6, 1.4] } },
      { id: "memoria-label", type: "symbol", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["concat", ["get", "nome"], "  ·  ", ["get", "anno"]],
          "text-font": ["Noto Sans Italic"], "text-size": 11.5, "symbol-spacing": 500, "text-offset": [0, -1.2], "text-letter-spacing": 0.03 },
        paint: label(COLORS.memoria, { "text-halo-width": 2 }) },
    ],
  },
  {
    // Dai dati di base OpenStreetMap: i corsi d'acqua marcati come "tunnel".
    id: "nascosta", group: "invisibile", swatch: "line-dot", source: "omt", visible: false,
    mapLayers: [
      { id: "nascosta-glow", type: "line", "source-layer": "waterway",
        filter: ["==", ["get", "brunnel"], "tunnel"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.nascosta, "line-width": zw(6, 18), "line-opacity": 0.18, "line-blur": 4 } },
      { id: "nascosta", type: "line", interactive: true, "source-layer": "waterway",
        filter: ["==", ["get", "brunnel"], "tunnel"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.nascosta, "line-width": zw(1.8, 4), "line-dasharray": [0.4, 1.8] } },
    ],
  },
];

// Icone disegnate in SVG e registrate nella mappa (a 2x per gli schermi retina).
const ICON_SVG = {
  fontana: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="22" fill="${COLORS.fontane}" stroke="${DARK}" stroke-width="3"/>
    <g fill="none" stroke="${DARK}" stroke-width="2.8" stroke-linecap="round">
      <path d="M28 34 V20"/><path d="M28 21 C 22 17, 18 22, 18 28"/><path d="M28 21 C 34 17, 38 22, 38 28"/>
      <path d="M17 35 H39"/></g></svg>`,
  casa: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <rect x="7" y="7" width="42" height="42" rx="11" fill="${COLORS.case}" stroke="${DARK}" stroke-width="3"/>
    <path d="M28 15 C 23 23, 20 27, 20 31.5 A 8 8 0 0 0 36 31.5 C 36 27, 33 23, 28 15 Z" fill="${DARK}"/>
    <circle cx="25" cy="31" r="1.6" fill="${COLORS.case}"/><circle cx="30" cy="34" r="1.2" fill="${COLORS.case}"/></svg>`,
  piscina: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="22" fill="${COLORS.piscine}" stroke="${DARK}" stroke-width="3"/>
    <g fill="none" stroke="${DARK}" stroke-width="2.8" stroke-linecap="round">
      <path d="M16 24 q3 -3 6 0 t6 0 t6 0 t6 0"/><path d="M16 31 q3 -3 6 0 t6 0 t6 0 t6 0"/><path d="M16 38 q3 -3 6 0 t6 0 t6 0 t6 0"/></g></svg>`,
  arrow: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <path d="M8 34 L22 8 L36 34 L22 27 Z" fill="${COLORS.deriva}" stroke="${DARK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
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
