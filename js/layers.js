// Configurazione dei livelli tematici.
// Per aggiungere un livello: mettere il GeoJSON in data/, aggiungere una voce
// qui sotto e i testi "layer.<id>" / "desc.<id>" in i18n.js.

// Colori luminosi su fondo notturno: l'acqua corrente in celeste, ogni tipo di punto con la sua luce.
export const COLORS = {
  // tutto nella famiglia dell'acqua: celesti, azzurri, blu, turchesi e verde acqua
  fiumi: "#4fd2ff",          // celeste brillante
  fontanili: "#d2f7ff",      // celeste ghiaccio: l'acqua che nasce
  canali: "#2f7dff",         // azzurro intenso
  memoria: "#e6f9ff",
  laghi: "#1a9fc4",          // blu petrolio
  fontane: "#9ad8ff",        // celeste cielo
  piscine: "#5a6bff",        // blu oltremare, il colore delle vasche
  piscineChiuse: "#4f6873",  // grigio azzurro
  case: "#12b8a6",           // turchese profondo
  vedovelle: "#8ef5e4",      // verde acqua chiaro
  deriva: "#ff6b4a",
};
// contorno scuro dei simboli e alone delle etichette
const DARK = "#03121a";

// I tre cicli dell'acqua della tesi, dal più grande e naturale al più piccolo e quotidiano.
export const GROUPS = ["territorio", "contenuta", "consumo"];

const zw = (a, b) => ["interpolate", ["exponential", 1.4], ["zoom"], 10, a, 16, b];
// alone luminoso sotto i punti
const glow = (id, color, r0, r1) => ({ id: `${id}-glow`, type: "circle",
  paint: { "circle-color": color, "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, r0, 15, r1],
    "circle-opacity": 0.28, "circle-blur": 1 } });
const label = (color, extra = {}) => ({ "text-color": color, "text-halo-color": DARK, "text-halo-width": 1.6, ...extra });
const lineLabel = (minzoom, size, color) => ({ type: "symbol", minzoom,
  layout: { "symbol-placement": "line", "text-field": ["get", "nome"], "text-font": ["Noto Sans Italic"], "text-size": size,
    "symbol-spacing": 380, "text-offset": [0, -1] },
  paint: label(color) });
const NAVIGLIO = ["==", ["get", "naviglio"], true];

export const LAYERS = [
  // 1. L'acqua del territorio: ciclo aperto
  {
    id: "fiumi", group: "territorio", swatch: "line", data: "data/fiumi.geojson", visible: true,
    mapLayers: [
      { id: "fiumi-glow", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fiumi, "line-width": zw(7, 22), "line-opacity": 0.2, "line-blur": zw(4, 10) } },
      { id: "fiumi", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fiumi, "line-width": zw(1.6, 4.2) } },
      { id: "fiumi-label", ...lineLabel(12.5, 11.5, COLORS.fiumi) },
    ],
  },
  {
    id: "fontanili", group: "territorio", swatch: "line", data: "data/fontanili.geojson", visible: true,
    mapLayers: [
      { id: "fontanili-glow", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fontanili, "line-width": zw(5, 14), "line-opacity": 0.22, "line-blur": zw(3, 7) } },
      { id: "fontanili", type: "line", interactive: true, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.fontanili, "line-width": zw(1, 2.6) } },
      { id: "fontanili-label", ...lineLabel(13, 10.5, COLORS.fontanili) },
    ],
  },
  {
    // Reticolo di Bonifica e Minore: i navigli più marcati, le rogge sottili
    id: "canali", group: "territorio", swatch: "line", data: "data/canali.geojson", visible: true,
    mapLayers: [
      { id: "rogge", type: "line", interactive: true, filter: ["!", NAVIGLIO], layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.canali, "line-width": zw(0.5, 1.8), "line-opacity": 0.6 } },
      { id: "navigli-glow", type: "line", filter: NAVIGLIO, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.canali, "line-width": zw(8, 26), "line-opacity": 0.24, "line-blur": zw(4, 12) } },
      { id: "navigli", type: "line", interactive: true, filter: NAVIGLIO, layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.canali, "line-width": zw(1.8, 5) } },
      { id: "navigli-label", filter: NAVIGLIO, ...lineLabel(12, ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 14], COLORS.canali) },
      { id: "rogge-label", filter: ["!", NAVIGLIO], ...lineLabel(14.5, 10, COLORS.canali) },
    ],
  },
  {
    // Ricostruzione indicativa, non dato ufficiale: in attesa di conferma, spenta all'avvio
    id: "memoria", group: "territorio", swatch: "line-dash", data: "data/memoria.geojson", visible: false,
    mapLayers: [
      { id: "memoria-halo", type: "line", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": COLORS.memoria, "line-width": zw(6, 24), "line-opacity": 0.12, "line-blur": zw(3, 10) } },
      { id: "memoria", type: "line", interactive: true, layout: { "line-join": "round" },
        paint: { "line-color": COLORS.memoria, "line-width": zw(1.4, 3.4), "line-dasharray": [1.6, 1.4] } },
      { id: "memoria-label", type: "symbol", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["concat", ["get", "nome"], "  ·  ", ["get", "anno"]],
          "text-font": ["Noto Sans Italic"], "text-size": 11.5, "symbol-spacing": 500, "text-offset": [0, -1.2], "text-letter-spacing": 0.03 },
        paint: label(COLORS.memoria, { "text-halo-width": 2 }) },
    ],
  },

  // 2. L'acqua contenuta in città: ciclo chiuso
  {
    id: "laghi", group: "contenuta", swatch: "fill", data: "data/laghi.geojson", visible: true,
    mapLayers: [
      { id: "laghi", type: "fill", interactive: true, paint: { "fill-color": COLORS.laghi, "fill-opacity": 0.38 } },
      { id: "laghi-line", type: "line", paint: { "line-color": COLORS.laghi, "line-width": zw(0.8, 2), "line-opacity": 0.9 } },
      { id: "laghi-label", type: "symbol", minzoom: 12.5,
        layout: { "text-field": ["coalesce", ["get", "nome"], ""], "text-font": ["Noto Sans Italic"], "text-size": 11.5 },
        paint: label(COLORS.laghi) },
    ],
  },
  {
    id: "fontane", group: "contenuta", swatch: "icon", icon: "fontana", data: "data/fontane.geojson", visible: true,
    mapLayers: [
      glow("fontane", COLORS.fontane, 8, 18),
      { id: "fontane", type: "symbol", interactive: true,
        layout: { "icon-image": "fontana", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 15, 1],
          "icon-allow-overlap": true, "icon-padding": 0 } },
    ],
  },
  {
    // Le 8 piscine comunali all'aperto: accese quelle aperte nell'estate 2026, spente le chiuse
    id: "piscine", group: "contenuta", swatch: "icon", icon: "piscina", data: "data/piscine.geojson", visible: true,
    mapLayers: [
      { ...glow("piscine", COLORS.piscine, 10, 22), filter: ["==", ["get", "stato"], "attiva"] },
      { id: "piscine", type: "symbol", interactive: true,
        layout: { "icon-image": ["match", ["get", "stato"], "attiva", "piscina", "piscina-chiusa"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.75, 15, 1.15], "icon-allow-overlap": true } },
      { id: "piscine-label", type: "symbol", minzoom: 12,
        layout: { "text-field": ["get", "nome"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.6], "text-anchor": "top" },
        paint: label(["match", ["get", "stato"], "attiva", COLORS.piscine, "#8aa3ad"]) },
    ],
  },

  // 3. L'acqua di consumo urbano: ciclo integrato
  {
    id: "case", group: "consumo", swatch: "icon", icon: "casa", data: "data/case_acqua.geojson", visible: true,
    mapLayers: [
      glow("case", COLORS.case, 8, 18),
      { id: "case", type: "symbol", interactive: true,
        layout: { "icon-image": "casa", "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 15, 1], "icon-allow-overlap": true } },
    ],
  },
  {
    id: "vedovelle", group: "consumo", swatch: "dot", data: "data/fontanelle.geojson", visible: true,
    mapLayers: [
      { id: "vedovelle-glow", type: "circle",
        paint: { "circle-color": COLORS.vedovelle, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 13, 6, 16, 12],
          "circle-opacity": 0.22, "circle-blur": 1 } },
      { id: "vedovelle", type: "circle", interactive: true,
        paint: { "circle-color": COLORS.vedovelle, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 13, 2.8, 16, 5.5],
          "circle-stroke-color": DARK, "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 0.3, 15, 1.2] } },
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
  "piscina-chiusa": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="22" fill="${COLORS.piscineChiuse}" stroke="${DARK}" stroke-width="3"/>
    <g fill="none" stroke="${DARK}" stroke-width="2.8" stroke-linecap="round" opacity=".7">
      <path d="M16 24 q3 -3 6 0 t6 0 t6 0 t6 0"/><path d="M16 31 q3 -3 6 0 t6 0 t6 0 t6 0"/><path d="M16 38 q3 -3 6 0 t6 0 t6 0 t6 0"/></g>
    <path d="M14 42 L42 14" stroke="#c9d6db" stroke-width="3" stroke-linecap="round"/></svg>`,
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
