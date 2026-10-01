// GridAid deterministic demonstration data layer for Scott County / Davenport, IA.
// All data is synthetic demonstration data generated from a fixed seed so that
// identical inputs always produce identical outputs. This module is intentionally
// separated from the UI so a real backend (FastAPI / OSMnx / OR-Tools) can
// replace these functions later without touching components.

// --- Seeded PRNG (mulberry32) -------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240901);
function next() {
  return rand();
}
function rangeRand(min, max) {
  return min + (max - min) * next();
}
function gaussRand() {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = next();
  while (v === 0) v = next();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// --- Study area ----------------------------------------------------------
export const STUDY_AREA = {
  name: "Scott County / Davenport, Iowa",
  center: { lat: 41.5236, lng: -90.5776 },
  bounds: { south: 41.4, west: -90.72, north: 41.66, east: -90.42 },
  provenance: "SYNTHETIC DEMO",
};

// --- Geometry helpers ----------------------------------------------------
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distance from point p to segment ab (in km, approximated as planar on small area)
export function pointToSegmentKm(p, a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  // approximate km per degree
  const kmPerLat = 111;
  const kmPerLng = 111 * Math.cos(toRad(p.lat));
  const px = p.lng * kmPerLng;
  const py = p.lat * kmPerLat;
  const ax = a.lng * kmPerLng;
  const ay = a.lat * kmPerLat;
  const bx = b.lng * kmPerLng;
  const by = b.lat * kmPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

export function pointToPolylineKm(p, coords) {
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentKm(p, coords[i], coords[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// --- Modeled travel time -------------------------------------------------
// Straight-line distance is never the routing method in production (real
// OSM/Dijkstra routing lives behind the future API). For this deterministic
// demo we approximate network distance as ~1.3x straight-line and apply a
// modeled speed, then apply scenario modifiers. The UI always labels this as
// "modeled travel time", never actual response time.
const NETWORK_FACTOR = 1.3;
const BASE_SPEED_KMH = 48;

export function baseTravelTimeMin(demand, site) {
  const dist = haversineKm(demand, site) * NETWORK_FACTOR;
  return (dist / BASE_SPEED_KMH) * 60;
}

// --- Roads ---------------------------------------------------------------
// A small set of named major roads through the study area. Coordinates are
// synthetic but arranged to resemble the Davenport road grid.
function makeRoad(id, name, cls, a, b, jitter = 0.004) {
  const steps = 6;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = a.lat + (b.lat - a.lat) * t + (next() - 0.5) * jitter;
    const lng = a.lng + (b.lng - a.lng) * t + (next() - 0.5) * jitter;
    coords.push({ lat, lng });
  }
  const speed =
    cls === "interstate" ? 100 : cls === "arterial" ? 56 : 40;
  return { id, name, class: cls, coords, speed };
}

const ROADS = [
  makeRoad("I-80", "I-80", "interstate", { lat: 41.61, lng: -90.72 }, { lat: 41.6, lng: -90.42 }),
  makeRoad("I-280", "I-280", "interstate", { lat: 41.5, lng: -90.72 }, { lat: 41.62, lng: -90.55 }),
  makeRoad("US-61", "US-61", "arterial", { lat: 41.4, lng: -90.58 }, { lat: 41.66, lng: -90.58 }),
  makeRoad("US-67", "US-67 (River Dr)", "arterial", { lat: 41.52, lng: -90.6 }, { lat: 41.42, lng: -90.5 }),
  makeRoad("brady", "Brady Street", "arterial", { lat: 41.48, lng: -90.6 }, { lat: 41.62, lng: -90.6 }),
  makeRoad("division", "Division Street", "arterial", { lat: 41.48, lng: -90.57 }, { lat: 41.6, lng: -90.57 }),
  makeRoad("kimberly", "Kimberly Road", "arterial", { lat: 41.56, lng: -90.7 }, { lat: 41.56, lng: -90.45 }),
  makeRoad("locust", "Locust Street", "arterial", { lat: 41.5, lng: -90.55 }, { lat: 41.62, lng: -90.55 }),
  makeRoad("welcome", "Welcome Way", "arterial", { lat: 41.5, lng: -90.62 }, { lat: 41.62, lng: -90.62 }),
  makeRoad("53rd", "53rd Street", "local", { lat: 41.52, lng: -90.62 }, { lat: 41.52, lng: -90.5 }),
  makeRoad("middle", "Middle Road", "local", { lat: 41.58, lng: -90.7 }, { lat: 41.5, lng: -90.5 }),
  makeRoad("eastern", "Eastern Avenue", "local", { lat: 41.5, lng: -90.5 }, { lat: 41.62, lng: -90.5 }),
];

export function getRoads() {
  return ROADS;
}

// --- Candidate locations -------------------------------------------------
// ~120 candidate sites spread across the study area, clustered lightly near
// population centers. These represent public facilities / staging areas —
// never private addresses.
function generateCandidates() {
  const centers = [
    { lat: 41.523, lng: -90.59, spread: 0.05 }, // Davenport core
    { lat: 41.55, lng: -90.5, spread: 0.04 }, // NE
    { lat: 41.48, lng: -90.62, spread: 0.04 }, // SW
    { lat: 41.58, lng: -90.62, spread: 0.04 }, // NW
  ];
  const list = [];
  for (let i = 0; i < 120; i++) {
    const c = centers[Math.floor(next() * centers.length)];
    const lat = c.lat + gaussRand() * c.spread;
    const lng = c.lng + gaussRand() * c.spread * 1.4;
    list.push({
      id: `C${i}`,
      lat,
      lng,
      type: "candidate",
    });
  }
  return list;
}

// --- Demand points (population + transport risk) -------------------------
function generateDemand() {
  const centers = [
    { lat: 41.523, lng: -90.59, w: 0.34 },
    { lat: 41.55, lng: -90.5, w: 0.18 },
    { lat: 41.48, lng: -90.62, w: 0.16 },
    { lat: 41.58, lng: -90.62, w: 0.14 },
    { lat: 41.5, lng: -90.5, w: 0.1 },
    { lat: 41.6, lng: -90.55, w: 0.08 },
  ];
  const list = [];
  for (let i = 0; i < 80; i++) {
    const r = next();
    let acc = 0;
    let c = centers[0];
    for (const ctr of centers) {
      acc += ctr.w;
      if (r <= acc) {
        c = ctr;
        break;
      }
    }
    const lat = c.lat + gaussRand() * 0.03;
    const lng = c.lng + gaussRand() * 0.04;
    const population = Math.round(60 + next() * 1900);
    // transport risk: higher near major roads
    let minRoadDist = Infinity;
    for (const road of ROADS) {
      const d = pointToPolylineKm({ lat, lng }, road.coords);
      if (d < minRoadDist) minRoadDist = d;
    }
    const proximity = Math.max(0, 1 - minRoadDist / 1.5);
    const risk = Math.min(1, 0.15 + proximity * 0.6 + next() * 0.25);
    list.push({
      id: `D${i}`,
      lat,
      lng,
      population,
      risk,
      // demand weight depends on focus; precompute both
      weightPop: population,
      weightRisk: population * (0.4 + risk),
      weightBalanced: population * (0.5 + risk * 0.5),
    });
  }
  return list;
}

const CANDIDATES = generateCandidates();
const DEMAND = generateDemand();

export function getCandidates() {
  return CANDIDATES;
}
export function getDemand() {
  return DEMAND;
}

// Baseline "Starting Layout" — a deterministic but non-optimized selection
// of 5 resources, deliberately mediocre for comparison.
const BASELINE_IDS = ["C12", "C40", "C68", "C95", "C110"];
export function getBaselineIds() {
  return BASELINE_IDS;
}

export function getDemandWeight(d, focus, balance = 0.5) {
  if (focus === "population") return d.weightPop;
  if (focus === "risk") return d.weightRisk;
  // balanced: blend by balance slider (0 = population, 1 = risk)
  return d.weightPop * (1 - balance) + d.weightRisk * balance;
}