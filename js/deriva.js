// Deriva d'acqua: genera un percorso a piedi, diverso ogni volta, che salta
// da un'acqua all'altra. Ispirato alla deriva situazionista e alle frecce di
// "The Naked City" di Guy Debord (1957).

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distance([lon1, lat1], [lon2, lat2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing([lon1, lat1], [lon2, lat2]) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Le vedovelle sono tante: pesano meno, così la deriva incontra acque diverse.
const WEIGHT = { vedovella: 1, casa: 3, fontana: 3.5, piscina: 2.5, naviglio: 3, fiume: 2, memoria: 3.5 };

// Campiona punti lungo le linee (ogni ~step metri), per poter "toccare" i canali.
function sampleLines(features, type, step = 220) {
  const out = [];
  for (const f of features) {
    const g = f.geometry;
    const parts = g.type === "MultiLineString" ? g.coordinates : [g.coordinates];
    for (const line of parts) {
      let acc = step;
      for (let i = 1; i < line.length; i++) {
        acc += distance(line[i - 1], line[i]);
        if (acc >= step) {
          out.push({ type, coord: line[i], name: f.properties.nome });
          acc = 0;
        }
      }
    }
  }
  return out;
}

export function buildPool(data) {
  const pts = (fc, type, nameKey) => fc.features.map((f) => ({ type, coord: f.geometry.coordinates, name: nameKey ? f.properties[nameKey] : null }));
  return [
    ...pts(data.vedovelle, "vedovella"),
    ...pts(data.case, "casa"),
    ...pts(data.fontane, "fontana", "nome"),
    ...pts(data.piscine, "piscina", "indirizzo"),
    ...sampleLines(data.canali.features.filter((f) => f.properties.naviglio), "naviglio"),
    ...sampleLines(data.fiumi.features.filter((f) => f.properties.nome), "fiume", 300),
    ...sampleLines(data.memoria.features, "memoria", 180),
  ];
}

function pickWeighted(items, weightFn) {
  const ws = items.map(weightFn);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function generateDrift(pool, { start = null, stops = 7 } = {}) {
  let current;
  if (start) {
    current = { type: "start", coord: start, name: null };
  } else {
    const central = pool.filter((p) => p.type === "fontana" || p.type === "memoria" || p.type === "naviglio")
      .filter((p) => distance(p.coord, [9.19, 45.464]) < 3500);
    current = central[Math.floor(Math.random() * central.length)];
  }
  const route = [current];
  let heading = null;
  for (let s = 0; s < stops; s++) {
    let candidates = [];
    for (const [min, max] of [[220, 700], [150, 1100], [100, 1800]]) {
      candidates = pool.filter((p) => {
        const d = distance(current.coord, p.coord);
        if (d < min || d > max) return false;
        if (route.some((q) => distance(q.coord, p.coord) < 160)) return false;
        return heading === null || angleDiff(bearing(current.coord, p.coord), heading) < 110;
      });
      if (candidates.length) break;
    }
    if (!candidates.length) break;
    const last = current.type;
    const next = pickWeighted(candidates, (p) => (WEIGHT[p.type] || 1) * (p.type === last ? 0.35 : 1));
    heading = bearing(current.coord, next.coord);
    route.push(next);
    current = next;
  }
  return route;
}

// Segmento leggermente curvo, come tracciato a mano.
function curve(a, b, bend) {
  const k = Math.cos(rad((a[1] + b[1]) / 2));
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
  const cx = mx + (-dy * bend) / k, cy = my + dx * bend;
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
  }
  return pts;
}

export function driftGeoJSON(route) {
  const segments = [], arrows = [], stops = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1].coord, b = route[i].coord;
    total += distance(a, b);
    const bend = (i % 2 ? 1 : -1) * (0.12 + Math.random() * 0.12);
    const line = curve(a, b, bend);
    // accorcia la linea alle estremità, per non coprire i simboli
    const trimmed = line.slice(2, -2);
    segments.push({ type: "Feature", properties: { i }, geometry: { type: "LineString", coordinates: trimmed } });
    const tip = trimmed[trimmed.length - 1], prev = trimmed[trimmed.length - 2];
    arrows.push({ type: "Feature", properties: { rot: bearing(prev, tip) }, geometry: { type: "Point", coordinates: tip } });
  }
  route.forEach((p, i) => stops.push({ type: "Feature", properties: { n: i === 0 ? "●" : String(i), type: p.type },
    geometry: { type: "Point", coordinates: p.coord } }));
  return {
    total,
    segments: { type: "FeatureCollection", features: segments },
    arrows: { type: "FeatureCollection", features: arrows },
    stops: { type: "FeatureCollection", features: stops },
  };
}
