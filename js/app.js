import { LANGS, STORY, PROMPTS, makeT } from "./i18n.js?v=22";
import { baseStyle, NIGHT, registerLocalBasemap } from "./basemap.js?v=22";
import { LAYERS, GROUPS, COLORS, loadIcons, iconSvg } from "./layers.js?v=22";
import { buildPool, generateDrift, driftGeoJSON } from "./deriva.js?v=22";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => matchMedia("(max-width: 760px)").matches;

// Modalità attive. Per riattivare il racconto o la deriva basta aggiungerle qui:
// ["story", "explore", "drift"]. Con una sola modalità la barra delle schede sparisce.
const MODES = ["explore"];
const EXPLORE_CAMERA = { center: [9.19, 45.466], zoom: 12.3 };
// Zona visibile: Milano e la prima cintura (da Rho a Segrate, da Bollate a Opera).
// La mappa non si può spostare né allontanare oltre questo rettangolo.
const AREA = [[8.98, 45.34], [9.4, 45.57]];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage non disponibile */ } },
};

const state = {
  lang: LANGS.includes(store.get("lang")) ? store.get("lang") : "it",
  mode: "story",
  step: 0,
  explore: Object.fromEntries(LAYERS.map((l) => [l.id, l.visible])),
  data: {},
  counts: {},
  drift: null,
  selected: null,
};
let t = makeT(state.lang);

// Ordine di disegno: dal reticolo minore in basso ai punti in alto.
const DRAW_ORDER = ["laghi", "canali", "fiumi", "fontanili", "memoria", "vedovelle", "fontane", "case", "piscine"];
const byId = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
const interactiveIds = LAYERS.flatMap((l) => l.mapLayers.filter((m) => m.interactive).map((m) => m.id));
const layerOfMapLayer = Object.fromEntries(LAYERS.flatMap((l) => l.mapLayers.map((m) => [m.id, l.id])));

// ---------- mappa ----------
registerLocalBasemap(maplibregl);
const map = new maplibregl.Map({
  container: "map",
  style: baseStyle(),
  center: (MODES[0] === "story" ? STORY[0].camera : EXPLORE_CAMERA).center,
  zoom: (MODES[0] === "story" ? STORY[0].camera : EXPLORE_CAMERA).zoom - (isMobile() ? 1 : 0),
  minZoom: 10,
  maxZoom: 18.5,
  maxBounds: AREA,
  attributionControl: { compact: true },
  dragRotate: true,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

const loader = document.createElement("div");
loader.className = "loader";
loader.innerHTML = '<svg viewBox="0 0 32 32"><path d="M16 3C11 11 7 16 7 21a9 9 0 0 0 18 0c0-5-4-10-9-18z"/></svg>';
document.body.append(loader);

// I dati portano lo stesso numero di versione del codice (app.js?v=…), così il browser
// non mescola file vecchi e nuovi dopo un aggiornamento.
const VERSION = new URL(import.meta.url).searchParams.get("v");
const fresh = (url) => (VERSION ? `${url}?v=${VERSION}` : url);

async function loadData() {
  const files = Object.fromEntries(LAYERS.filter((l) => l.data).map((l) => [l.id, l.data]));
  files.confine = "data/confine.geojson";
  const entries = await Promise.all(Object.entries(files).map(async ([k, url]) => [k, await (await fetch(fresh(url))).json()]));
  state.data = Object.fromEntries(entries);
  // foto e video delle schede (data/media.json): { livello: { id: { video, poster } } }
  try { state.media = await (await fetch(fresh("data/media.json"))).json(); } catch { state.media = {}; }
  for (const l of LAYERS) if (state.data[l.id]) state.counts[l.id] = state.data[l.id].features.length;
}

function addMask() {
  // Tutto ciò che sta fuori dal Comune viene velato di scuro.
  const ring = state.data.confine.features[0].geometry;
  const holes = ring.type === "Polygon" ? [ring.coordinates[0]] : ring.coordinates.map((p) => p[0]);
  map.addSource("mask", { type: "geojson", data: { type: "Feature", properties: {},
    geometry: { type: "Polygon", coordinates: [[[0, 30], [20, 30], [20, 60], [0, 60], [0, 30]], ...holes] } } });
  map.addSource("confine", { type: "geojson", data: state.data.confine });
  map.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": NIGHT.mask, "fill-opacity": 0.62 } }, "road-label");
  map.addLayer({ id: "confine", type: "line", source: "confine",
    paint: { "line-color": NIGHT.street, "line-opacity": 0.45, "line-width": 1.1, "line-dasharray": [4, 3] } }, "road-label");
}

function addThematicLayers() {
  for (const id of DRAW_ORDER) {
    const cfg = byId[id];
    const source = cfg.source || `src-${id}`;
    if (!cfg.source) map.addSource(source, { type: "geojson", data: state.data[id] });
    const isPoint = ["vedovelle", "fontane", "case", "piscine"].includes(id);
    for (const ml of cfg.mapLayers) {
      const { interactive, ...spec } = ml;
      spec.source = source;
      spec.layout = { ...(spec.layout || {}), visibility: "none" };
      map.addLayer(spec, isPoint || spec.type === "symbol" ? undefined : "road-label");
    }
  }
  if (isMobile()) {
    // su schermi piccoli i simboli si affollano: più piccoli quando la mappa è lontana
    for (const id of ["fontane", "case", "piscine"]) {
      map.setLayoutProperty(id, "icon-size", ["interpolate", ["linear"], ["zoom"], 11, 0.4, 13, 0.6, 15, 0.95]);
    }
    map.setPaintProperty("vedovelle", "circle-radius", ["interpolate", ["linear"], ["zoom"], 10, 1.2, 13, 2.4, 16, 5.5]);
  }
}

function addDriftLayers() {
  const empty = { type: "FeatureCollection", features: [] };
  map.addSource("drift-seg", { type: "geojson", data: empty });
  map.addSource("drift-arrow", { type: "geojson", data: empty });
  map.addSource("drift-stop", { type: "geojson", data: empty });
  map.addLayer({ id: "drift-seg-halo", type: "line", source: "drift-seg", layout: { "line-cap": "round" },
    paint: { "line-color": "#fff", "line-width": 7, "line-opacity": 0.8 } });
  map.addLayer({ id: "drift-seg", type: "line", source: "drift-seg", layout: { "line-cap": "round" },
    paint: { "line-color": COLORS.deriva, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 5] } });
  map.addLayer({ id: "drift-arrow", type: "symbol", source: "drift-arrow",
    layout: { "icon-image": "arrow", "icon-rotate": ["get", "rot"], "icon-rotation-alignment": "map",
      "icon-allow-overlap": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 16, 1.2] } });
  map.addLayer({ id: "drift-stop-active", type: "circle", source: "drift-stop", filter: ["==", ["get", "n"], ""],
    paint: { "circle-color": COLORS.deriva, "circle-opacity": 0.18, "circle-radius": 26,
      "circle-stroke-color": COLORS.deriva, "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "drift-stop", type: "circle", source: "drift-stop",
    paint: { "circle-color": COLORS.deriva, "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 9, 16, 13],
      "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
  map.addLayer({ id: "drift-stop-n", type: "symbol", source: "drift-stop",
    layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true },
    paint: { "text-color": "#fff" } });
}

function setDriftVisible(on) {
  for (const id of ["drift-seg-halo", "drift-seg", "drift-arrow", "drift-stop-active", "drift-stop", "drift-stop-n"]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

function setLayers(visibleIds) {
  const on = new Set(visibleIds);
  for (const cfg of LAYERS) {
    for (const ml of cfg.mapLayers) {
      if (map.getLayer(ml.id)) map.setLayoutProperty(ml.id, "visibility", on.has(cfg.id) ? "visible" : "none");
    }
  }
}

// La mappa resta libera tra i comandi in alto e il pannello in basso (su mobile, e in Esplora anche su desktop):
// il margine si calcola su ciò che è davvero visibile in quel momento.
function mobilePadding() {
  const top = $(".topbar").getBoundingClientRect().bottom + 16;
  const sheets = [$(".step.is-active .step-card"), $("#explore"), $("#drift"), $("#card"), $(".modes")]
    .filter((el) => el && !el.hidden && el.offsetParent !== null)
    .map((el) => el.getBoundingClientRect().top)
    .filter((y) => y > top);
  const sheetTop = sheets.length ? Math.min(...sheets) : window.innerHeight * 0.6;
  return { top, bottom: Math.max(40, window.innerHeight - sheetTop + 16), left: 24, right: 24 };
}

// Le inquadrature del racconto sono pensate per ~960 px di mappa: su schermi stretti si allontana.
const zoomOffset = () => (isMobile() ? Math.min(1.6, Math.max(0, Math.log2(960 / window.innerWidth) * 0.95)) : 0);

function fly(camera, minZoom = 0) {
  map.flyTo({ ...camera, duration: reduceMotion ? 0 : 2400, essential: true,
    zoom: Math.max(minZoom, camera.zoom - zoomOffset()),
    padding: isMobile() ? mobilePadding() : { left: 480, top: 0, right: 0, bottom: 0 } });
}

// ---------- utilità di presentazione ----------
function swatch(cfg) {
  const c = COLORS[cfg.id];
  if (cfg.swatch === "icon") return `<span class="sw icon">${iconSvg(cfg.icon)}</span>`;
  return `<span class="sw ${cfg.swatch}" style="--c:${c}"></span>`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => new Intl.NumberFormat(state.lang).format(n);
const countVars = () => Object.fromEntries(Object.entries(state.counts).map(([k, v]) => [k, fmt(v)]));

// ---------- testi statici ----------
function renderStatic() {
  document.documentElement.lang = state.lang;
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  updateCollapseButtons();
  $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
  $("#card-close").setAttribute("aria-label", t("ui.close"));
  $("#drift-generate").textContent = state.drift ? t("drift.again") : t("drift.generate");
  $("#drift-more").textContent = $("#drift").classList.contains("intro-open") ? t("ui.readLess") : t("ui.readMore");
  $("#open-sources").setAttribute("aria-label", t("ui.sources"));
}

// ---------- racconto ----------
let storyObserver;
function renderStory() {
  if (!MODES.includes("story")) return;
  const el = $("#story");
  const vars = countVars();
  el.innerHTML = STORY.map((s, i) => {
    const tx = s[state.lang] || s.it;
    const title = i === 0 ? tx.title.replace(/(acqua|agua|water)/i, "<em>$1</em>") : esc(tx.title);
    const legend = s.final ? "" : s.layers.map((id) => `<span>${swatch(byId[id])}${esc(t("layer." + id))}</span>`).join("");
    return `<div class="step" data-i="${i}" data-id="${s.id}">
      <div class="step-card">
        <button type="button" class="sheet-collapse" aria-expanded="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        <p class="kicker">${esc(tx.kicker.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""))}</p>
        <h2>${title}</h2>
        <p class="body">${esc(tx.body)}</p>
        ${legend ? `<div class="step-legend">${legend}</div>` : ""}
        ${i === 0 ? `<div class="scroll-hint">${esc(t("ui.scroll"))}</div>` : ""}
        ${s.final ? `<div class="step-cta"><a class="btn primary" href="#esplora">${esc(t("ui.toExplore"))}</a><a class="btn drift-btn" href="#deriva">${esc(t("ui.toDrift"))}</a></div>` : ""}
        <div class="step-nav">
          <button type="button" data-go="${i - 1}" aria-label="${esc(t("ui.prev"))}" ${i === 0 ? "disabled" : ""}>‹</button>
          <span>${i + 1} / ${STORY.length}${i === 0 ? ` · ${esc(t("ui.swipe"))} →` : ""}</span>
          <button type="button" data-go="${i + 1}" aria-label="${esc(t("ui.next"))}" ${i === STORY.length - 1 ? "disabled" : ""}>›</button>
        </div>
      </div></div>`;
  }).join("");
  el.onclick = (e) => {
    const b = e.target.closest("[data-go]");
    if (b) goStep(Number(b.dataset.go));
  };

  let prog = $(".story-progress");
  if (!prog) { prog = document.createElement("div"); prog.className = "story-progress"; document.body.append(prog); }
  prog.innerHTML = STORY.map((s, i) => `<button type="button" data-i="${i}" aria-label="${i + 1}"></button>`).join("");
  prog.onclick = (e) => {
    const b = e.target.closest("button");
    if (b) goStep(Number(b.dataset.i));
  };

  storyObserver?.disconnect();
  storyObserver = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) activateStep(Number(en.target.dataset.i));
  }, { root: el, threshold: 0.6 });
  $$(".step", el).forEach((s) => storyObserver.observe(s));
  markStep(state.step);
  updateCollapseButtons();
  // dopo un cambio di lingua si resta sulla stessa tappa
  if (isMobile()) el.scrollTo({ left: state.step * el.clientWidth, behavior: "instant" });
  else el.scrollTo({ top: $(`.step[data-i="${state.step}"]`, el).offsetTop, behavior: "instant" });
}

// Su desktop le tappe scorrono in verticale, su mobile di lato.
function goStep(i) {
  if (i < 0 || i >= STORY.length) return;
  const el = $("#story");
  const behavior = reduceMotion ? "auto" : "smooth";
  if (isMobile()) el.scrollTo({ left: i * el.clientWidth, behavior });
  else $(`.step[data-i="${i}"]`, el).scrollIntoView({ behavior });
}

function markStep(i) {
  $$(".step").forEach((s) => s.classList.toggle("is-active", Number(s.dataset.i) === i));
  $$(".story-progress button").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.i) === i));
}

function activateStep(i) {
  if (state.mode !== "story") return;
  const changed = i !== state.step;
  state.step = i;
  markStep(i);
  const s = STORY[i];
  setLayers(s.layers);
  if (changed || !activateStep.done) fly(s.camera, s.minZoom);
  activateStep.done = true;
}

// ---------- esplora ----------
function renderLayerList() {
  const vars = state.counts;
  $("#layer-list").innerHTML = GROUPS.map((g, gi) => {
    const items = LAYERS.filter((l) => l.group === g).map((l) => `
      <button type="button" class="layer" data-layer="${l.id}" aria-pressed="${state.explore[l.id]}">
        ${swatch(l)}
        <span class="name">${esc(t("layer." + l.id))}</span>
        <span class="count">${l.swatch.startsWith("line") || !vars[l.id] ? "" : fmt(vars[l.id])}</span>
        <span class="desc">${esc(t("desc." + l.id))}</span>
      </button>`).join("");
    return `<div class="group"><h3><span class="group-n">${gi + 1}</span>${esc(t("group." + g))}</h3>
      <p class="group-cycle">${esc(t("cycle." + g))}</p>${items}</div>`;
  }).join("");
  // le chip, raggruppate per ciclo: su mobile scorrono di lato, su desktop in tre colonne
  $("#layer-chips").innerHTML = GROUPS.map((g, gi) => `
    <div class="chip-group">
      <span class="chip-group-label" title="${esc(t("group." + g))}">${gi + 1} · ${esc(t("groupShort." + g))}</span>
      <div class="chip-row">${LAYERS.filter((l) => l.group === g).map((l) => `
        <button type="button" class="chip" data-layer="${l.id}" aria-pressed="${state.explore[l.id]}" title="${esc(t("layer." + l.id))}">${swatch(l)}<span>${esc(t("chip." + l.id))}</span></button>`).join("")}
      </div>
    </div>`).join("");
  updateLayersToggle();
}

function updateLayersToggle() {
  const open = $("#explore").classList.contains("is-open");
  const b = $("#layers-toggle");
  b.textContent = open ? t("ui.hide") : t("ui.showAll");
  b.setAttribute("aria-expanded", String(open));
}

$("#layers-toggle").addEventListener("click", () => {
  $("#explore").classList.toggle("is-open");
  updateLayersToggle();
});

$("#explore").addEventListener("click", (e) => {
  const b = e.target.closest("[data-layer]");
  if (!b) return;
  const id = b.dataset.layer;
  state.explore[id] = !state.explore[id];
  $$(`#explore [data-layer="${id}"]`).forEach((x) => x.setAttribute("aria-pressed", String(state.explore[id])));
  applyExplore();
});

function applyExplore() {
  setLayers(Object.entries(state.explore).filter(([, v]) => v).map(([k]) => k));
}

// ---------- scheda ----------
const TYPE_OF = { vedovelle: "vedovella", case: "casa", fontane: "fontana", piscine: "piscina", canali: "canale", fiumi: "fiume", fontanili: "fontanile", laghi: "lago", memoria: "memoria" };
const RETE = { RIP: "rete.RIP", RIB: "rete.RIB", RIM: "rete.RIM" };
const fmtArea = (mq) => (mq >= 10000 ? `${fmt(Math.round(mq / 1000) / 10)} ha` : `${fmt(Math.round(mq / 10) * 10)} m²`);

function cardHTML(layerId, f) {
  const p = f.properties || {};
  const type = layerId === "canali" ? (p.naviglio ? "naviglio" : "roggia") : TYPE_OF[layerId];
  const head = `<div class="type">${swatch(byId[layerId])}${esc(t("card." + type))}</div>`;
  const [lon, lat] = f.geometry.type === "Point" ? f.geometry.coordinates : [state.clickLngLat.lng, state.clickLngLat.lat];
  const coords = `<div class="coords">${lat.toFixed(5)}° N · ${lon.toFixed(5)}° E</div>`;
  const where = [p.nil, p.municipio ? `${t("ui.municipio")} ${p.municipio}` : null].filter(Boolean).join(" · ");
  return mediaHTML(layerId, p) + cardBody(layerId, p, head, where, coords);
}

// Video in loop, come un'immagine in movimento: parte senza audio (i browser non permettono
// altro), un tocco lo mette in pausa e, se ha l'audio, il pulsante col parlante lo accende.
const SOUND_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9h4l5-4v14l-5-4H4z"/>
  <path class="on" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
function mediaHTML(layerId, p) {
  const m = state.media?.[layerId]?.[p.id];
  if (!m?.video) return "";
  const motion = !reduceMotion;
  return `<figure class="card-media">
    <video src="${esc(fresh(m.video))}" ${m.poster ? `poster="${esc(fresh(m.poster))}"` : ""} muted loop playsinline preload="metadata" ${motion ? "autoplay" : ""}></video>
    ${m.audio ? `<button type="button" class="media-sound" aria-label="${esc(t("ui.soundOn"))}" data-muted="true">${SOUND_ICON}</button>` : ""}
    <button type="button" class="media-toggle" aria-label="${esc(t(motion ? "ui.pause" : "ui.play"))}" data-playing="${motion}"></button>
  </figure>`;
}

function cardBody(layerId, p, head, where, coords) {
  switch (layerId) {
    case "vedovelle":
      return `${head}<h3>${esc(p.nil || t("card.vedovella"))}</h3><p class="meta">${esc(where)}</p><p class="text">${esc(t("card.vedovellaText"))}</p>${coords}`;
    case "case":
      return `${head}<h3>${esc(p.nil || t("card.casa"))}</h3><p class="meta">${esc(where)}</p><p class="text">${esc(t("card.casaText"))}</p>${coords}`;
    case "fontane": {
      const tags = [p.monumentale && t("card.monumentale"), p.storica && t("card.storica")].filter(Boolean).map((x) => `<span class="tag">${esc(x)}</span>`).join("");
      const more = p.url ? `<a class="btn" target="_blank" rel="noopener" href="${esc(p.url)}">${esc(t("ui.more"))} ↗</a>` : "";
      return `${head}<h3>${esc(p.nome)}</h3><p class="meta">${p.municipio ? esc(`${t("ui.municipio")} ${p.municipio}`) : ""}</p>${tags ? `<div class="tags">${tags}</div>` : ""}${more ? `<div class="actions">${more}</div>` : ""}${coords}`;
    }
    case "piscine": {
      const open = p.stato === "attiva";
      const tag = `<span class="tag ${open ? "" : "tag-off"}">${esc(t(open ? "card.piscinaAperta" : "card.piscinaChiusa"))}</span>`;
      return `${head}<h3>${esc(p.nome)}</h3><p class="meta">${esc([p.indirizzo, p.nil].filter(Boolean).join(" · "))}</p><div class="tags">${tag}</div><p class="text">${esc(t("card.piscinaText"))}</p>${coords}`;
    }
    case "fiumi":
    case "fontanili":
    case "canali":
      return `${head}<h3>${esc(p.nome || t("ui.unnamed"))}</h3><p class="meta">${esc(t(RETE[p.rete] || "ui.unnamed"))}</p><p class="text">${esc(t("desc." + layerId))}</p>`;
    case "laghi":
      return `${head}<h3>${esc(p.nome || p.parco || t("card.lago"))}</h3><p class="meta">${esc([p.nome ? p.parco : null, fmtArea(p.area_mq)].filter(Boolean).join(" · "))}</p><p class="text">${esc(t("desc.laghi"))}</p>`;
    case "memoria":
      return `${head}<h3>${esc(p.nome)}</h3><p class="meta">${esc(p.anno)} · ${esc(t("ui.indicative"))}</p><p class="text">${esc(t("card.memoriaText"))}</p>`;
    default:
      return `${head}<h3>${esc(p.nome || t("ui.unnamed"))}</h3><p class="meta">${esc(t("desc." + layerId))}</p>`;
  }
}

function openCard(layerId, f) {
  state.selected = { layerId, f };
  $("#card-body").innerHTML = cardHTML(layerId, f);
  $("#card").hidden = false;
  // se il video non si carica, meglio nessun riquadro che un riquadro nero
  const video = $("#card video");
  video?.addEventListener("error", () => video.closest(".card-media")?.remove(), { once: true });
  document.body.classList.add("has-card");
}
function closeCard() {
  state.selected = null;
  $("#card").hidden = true;
  document.body.classList.remove("has-card");
}
$("#card-close").addEventListener("click", closeCard);
$("#card").addEventListener("click", (e) => {
  const fig = e.target.closest(".card-media");
  if (!fig) return;
  const video = $("video", fig), btn = $(".media-toggle", fig);
  const sound = e.target.closest(".media-sound");
  if (sound) {
    video.muted = !video.muted;
    if (!video.muted && video.paused) video.play();
    sound.dataset.muted = String(video.muted);
    sound.setAttribute("aria-label", t(video.muted ? "ui.soundOn" : "ui.soundOff"));
  } else if (video.paused) video.play(); else video.pause();
  btn.dataset.playing = String(!video.paused);
  btn.setAttribute("aria-label", t(video.paused ? "ui.play" : "ui.pause"));
});

const tip = document.createElement("div");
tip.className = "map-tip";
tip.hidden = true;
document.body.append(tip);

function bindMapEvents() {
  const visibleInteractive = () => interactiveIds.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") === "visible");
  const pick = (point) => {
    const box = [[point.x - 6, point.y - 6], [point.x + 6, point.y + 6]];
    const feats = map.queryRenderedFeatures(box, { layers: visibleInteractive() });
    // i punti hanno la precedenza sulle linee
    return feats.find((f) => f.geometry.type === "Point") || feats[0];
  };
  map.on("click", (e) => {
    if (state.mode === "story") return;
    const f = pick(e.point);
    state.clickLngLat = e.lngLat;
    if (f) openCard(layerOfMapLayer[f.layer.id], f);
    else closeCard();
  });
  const canHover = matchMedia("(hover: hover)").matches;
  map.on("mousemove", (e) => {
    if (state.mode === "story" || !canHover) { tip.hidden = true; return; }
    const f = pick(e.point);
    map.getCanvas().style.cursor = f ? "pointer" : "";
    if (!f) { tip.hidden = true; return; }
    const id = layerOfMapLayer[f.layer.id];
    const p = f.properties;
    tip.textContent = p.nome || p.indirizzo || p.name || p.nil || t("layer." + id);
    tip.style.left = `${e.originalEvent.clientX}px`;
    tip.style.top = `${e.originalEvent.clientY}px`;
    tip.hidden = false;
  });
  map.on("mouseout", () => { tip.hidden = true; });
}

// ---------- deriva ----------
let pool = null;
function promptFor(type, seed) {
  const list = (PROMPTS[type] || PROMPTS.naviglio)[state.lang];
  return list[seed % list.length];
}

function runDrift(start = null) {
  pool ||= buildPool(state.data);
  const route = generateDrift(pool, { start });
  const geo = driftGeoJSON(route);
  // consegne in sequenza per tipo, così due tappe uguali non ripetono la stessa frase
  const counters = {};
  const seeded = route.map((p) => {
    counters[p.type] ??= Math.floor(Math.random() * 10);
    return { ...p, seed: counters[p.type]++ };
  });
  state.drift = { route: seeded, total: geo.total };
  map.getSource("drift-seg").setData(geo.segments);
  map.getSource("drift-arrow").setData(geo.arrows);
  map.getSource("drift-stop").setData(geo.stops);
  setDriftVisible(true);
  renderDrift();
  highlightStop(null);
  const b = new maplibregl.LngLatBounds();
  route.forEach((p) => b.extend(p.coord));
  // fitBounds somma il proprio margine a quello lasciato dall'ultimo flyTo: si azzera prima
  map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
  map.fitBounds(b, { padding: isMobile() ? mobilePadding() : { top: 80, bottom: 80, left: 440, right: 80 },
    maxZoom: 16, duration: reduceMotion ? 0 : 1800 });
}

const stopLabel = (i) => (i === 0 ? "●" : String(i));

function highlightStop(i) {
  if (map.getLayer("drift-stop-active")) map.setFilter("drift-stop-active", ["==", ["get", "n"], i === null ? "" : stopLabel(i)]);
  $$("#drift-stops li").forEach((li) => li.classList.toggle("is-active", Number(li.dataset.i) === i));
}

function focusStop(i) {
  const p = state.drift?.route[i];
  if (!p) return;
  highlightStop(i);
  map.flyTo({ center: p.coord, zoom: 16.5, duration: reduceMotion ? 0 : 1200,
    padding: isMobile() ? mobilePadding() : { left: 420, top: 0, right: 0, bottom: 0 } });
}

function renderDrift() {
  $("#drift-generate").textContent = state.drift ? t("drift.again") : t("drift.generate");
  if (!state.drift) return;
  const { route, total } = state.drift;
  const km = (total / 1000).toFixed(1).replace(".", state.lang === "en" ? "." : ",");
  const min = Math.round((total * 1.25) / 75); // ~4,5 km/h, con un margine per le strade non rettilinee
  $("#drift-summary").textContent = t("drift.summary", { n: route.length - 1, km, min });
  $("#drift-stops").innerHTML = route.map((p, i) => {
    const type = p.type === "start" ? "start" : p.type;
    const typeLabel = type === "start" ? t("drift.start") : t("card." + type);
    const prompt = type === "start" ? "" : promptFor(type, p.seed);
    return `<li data-i="${i}" data-n="${stopLabel(i)}">
      <div class="st-type">${esc(typeLabel)} <span class="st-count">${i + 1} / ${route.length}</span></div>
      ${p.name ? `<div class="st-name">${esc(p.name)}</div>` : ""}
      ${prompt ? `<div class="st-prompt">${esc(prompt)}</div>` : ""}
    </li>`;
  }).join("");
  $("#drift-result").hidden = false;
  observeStops();
}

// Su mobile le tappe sono schede da scorrere di lato: quella al centro guida la mappa.
let stopObserver;
function observeStops() {
  const list = $("#drift-stops");
  stopObserver?.disconnect();
  list.scrollLeft = 0;
  list.dataset.touched = "";
  if (!isMobile()) return;
  stopObserver = new IntersectionObserver((entries) => {
    if (!list.dataset.touched) return; // all'inizio si vede tutto il percorso
    for (const en of entries) if (en.isIntersecting) focusStop(Number(en.target.dataset.i));
  }, { root: list, threshold: 0.75 });
  $$("li", list).forEach((li) => stopObserver.observe(li));
}
for (const ev of ["pointerdown", "touchstart", "wheel"]) {
  $("#drift-stops").addEventListener(ev, (e) => { e.currentTarget.dataset.touched = "1"; }, { passive: true });
}

$("#drift-stops").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li || !state.drift) return;
  focusStop(Number(li.dataset.i));
});

$("#drift-more").addEventListener("click", () => {
  const open = $("#drift").classList.toggle("intro-open");
  $("#drift-more").textContent = open ? t("ui.readLess") : t("ui.readMore");
  $("#drift-more").setAttribute("aria-expanded", String(open));
});

$("#drift-generate").addEventListener("click", () => { $("#drift-msg").hidden = true; runDrift(); });
$("#drift-here").addEventListener("click", () => {
  const msg = $("#drift-msg");
  const fallback = (key) => { msg.textContent = t(key); msg.hidden = false; runDrift(); };
  if (!navigator.geolocation) return fallback("drift.geoError");
  navigator.geolocation.getCurrentPosition((pos) => {
    const c = [pos.coords.longitude, pos.coords.latitude];
    const inside = c[0] > 9.04 && c[0] < 9.28 && c[1] > 45.38 && c[1] < 45.54;
    if (!inside) return fallback("drift.outside");
    msg.hidden = true;
    runDrift(c);
  }, () => fallback("drift.geoError"), { timeout: 8000 });
});

// ---------- pannelli riducibili (mobile) ----------
// Un solo stato per tutti i pannelli: se lo riduci in una modalità, resta ridotto anche nelle altre.
function updateCollapseButtons() {
  const collapsed = document.body.classList.contains("sheets-collapsed");
  $$(".sheet-collapse").forEach((b) => {
    b.setAttribute("aria-expanded", String(!collapsed));
    b.setAttribute("aria-label", t(collapsed ? "ui.expand" : "ui.collapse"));
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".sheet-collapse")) return;
  document.body.classList.toggle("sheets-collapsed");
  updateCollapseButtons();
  // la mappa si ricentra sullo spazio liberato (o occupato) dal pannello
  if (state.ready && (isMobile() || state.mode === "explore")) map.easeTo({ padding: mobilePadding(), duration: reduceMotion ? 0 : 450 });
});

// ---------- modalità ----------
const HASH = { racconto: "story", esplora: "explore", deriva: "drift" };

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  $$(".modes a").forEach((a) => (a.dataset.mode === mode ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("#explore").hidden = mode !== "explore";
  $("#drift").hidden = mode !== "drift";
  tip.hidden = true;
  closeCard();
  if (!state.ready) return;
  if (mode === "story") {
    setDriftVisible(false);
    activateStep.done = false;
    activateStep(state.step);
  } else if (mode === "explore") {
    setDriftVisible(false);
    applyExplore();
  } else {
    setLayers(["navigli", "fiumi", "fontane", "vedovelle", "case", "piscine", "memoria"]);
    if (state.drift) setDriftVisible(true);
    else runDrift();
  }
}

function onHash() {
  const mode = HASH[location.hash.replace("#", "")];
  setMode(MODES.includes(mode) ? mode : MODES[0]);
}
window.addEventListener("hashchange", onHash);

$$(".lang button").forEach((b) => b.addEventListener("click", () => {
  state.lang = b.dataset.lang;
  store.set("lang", state.lang);
  t = makeT(state.lang);
  renderStatic();
  renderStory();
  renderLayerList();
  renderDrift();
  if (state.selected) openCard(state.selected.layerId, state.selected.f);
}));

const sources = $("#sources");
$("#open-sources").addEventListener("click", () => sources.showModal());
sources.addEventListener("click", (e) => { if (e.target === sources) sources.close(); });

// ---------- avvio ----------
$$(".modes a").forEach((a) => { a.hidden = !MODES.includes(a.dataset.mode); });
document.body.classList.toggle("single-mode", MODES.length === 1);
document.body.dataset.mode = MODES[0];
renderStatic();
const dataReady = loadData();
map.on("load", async () => {
  await Promise.all([dataReady, loadIcons(map)]);
  addMask();
  addThematicLayers();
  addDriftLayers();
  bindMapEvents();
  state.ready = true;
  renderStory();
  renderLayerList();
  onHash();
  // la vista iniziale si centra sulla parte di mappa non coperta dal pannello
  if (MODES[0] === "explore") {
    map.jumpTo({ center: EXPLORE_CAMERA.center, zoom: EXPLORE_CAMERA.zoom - (isMobile() ? 1 : 0),
      padding: mobilePadding() });
  }
  // su mobile i crediti partono chiusi nel pulsante ⓘ
  if (isMobile()) $(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  loader.classList.add("is-done");
  setTimeout(() => loader.remove(), 700);
});
