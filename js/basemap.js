// Stile della mappa di base: carta chiara e quasi monocroma, perché l'unico
// colore sia l'acqua. Dati vettoriali OpenStreetMap serviti da OpenFreeMap.

export const PAPER = {
  bg: "#f3efe6",
  park: "#e5e6d6",
  building: "#e7e1d4",
  buildingLine: "#dbd3c4",
  road: "#fdfbf7",
  roadCasing: "#ddd5c6",
  rail: "#cbc3b4",
  label: "#8b8476",
  labelStrong: "#5f594e",
  water: "#cbdde9",
  waterLine: "#a9c6dc",
};

const lines = (filter) => ["all", ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false], filter];
const polys = (filter) => ["all", ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false], filter];

export function baseStyle() {
  const P = PAPER;
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet",
        attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": P.bg } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": P.park, "fill-opacity": 0.8 } },
      { id: "landcover-grass", type: "fill", source: "omt", "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["grass", "wood", "farmland"], true, false],
        paint: { "fill-color": P.park, "fill-opacity": 0.45 } },
      { id: "base-water", type: "fill", source: "omt", "source-layer": "water",
        filter: polys(["!=", ["get", "brunnel"], "tunnel"]), paint: { "fill-color": P.water } },
      { id: "base-waterway", type: "line", source: "omt", "source-layer": "waterway",
        filter: lines(["!=", ["get", "brunnel"], "tunnel"]),
        paint: { "line-color": P.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 1.6] } },
      { id: "building", type: "fill", source: "omt", "source-layer": "building", minzoom: 13,
        paint: { "fill-color": P.building, "fill-outline-color": P.buildingLine,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, 1] } },
      { id: "rail", type: "line", source: "omt", "source-layer": "transportation",
        filter: lines(["==", ["get", "class"], "rail"]),
        paint: { "line-color": P.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 1.4], "line-dasharray": [3, 2] } },
      { id: "road-casing", type: "line", source: "omt", "source-layer": "transportation", minzoom: 12,
        filter: lines(["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"], true, false]),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": P.roadCasing,
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 12, 0.6, 14, 2.4, 17, 12] } },
      { id: "road", type: "line", source: "omt", "source-layer": "transportation",
        filter: lines(["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"], true, false]),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["step", ["zoom"], P.roadCasing, 12, P.road],
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 0.3, 14, 1.6, 17, 10] } },
      { id: "road-label", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14.5,
        filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "minor"], true, false],
        layout: { "symbol-placement": "line", "text-field": ["coalesce", ["get", "name:it"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9.5, 18, 12], "text-letter-spacing": 0.02 },
        paint: { "text-color": P.label, "text-halo-color": P.bg, "text-halo-width": 1.4 } },
      { id: "place-label", type: "symbol", source: "omt", "source-layer": "place", minzoom: 11.5,
        filter: ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood"], true, false],
        layout: { "text-field": ["upcase", ["coalesce", ["get", "name:it"], ["get", "name"]]],
          "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12, 9, 16, 12],
          "text-letter-spacing": 0.14, "text-max-width": 8 },
        paint: { "text-color": P.label, "text-halo-color": P.bg, "text-halo-width": 1.6, "text-opacity": 0.85 } },
      { id: "town-label", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 13,
        filter: ["match", ["get", "class"], ["town", "village"], true, false],
        layout: { "text-field": ["coalesce", ["get", "name:it"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 11 },
        paint: { "text-color": P.label, "text-halo-color": P.bg, "text-halo-width": 1.6 } },
    ],
  };
}
