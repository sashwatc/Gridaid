import React, { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Tooltip as LTooltip,
  useMapEvents,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers, X } from "lucide-react";
import {
  STUDY_AREA,
  getCandidates,
  getDemand,
  getRoads,
} from "@/lib/gridaid";

const candidates = getCandidates();
const demand = getDemand();
const roads = getRoads();

const COLORS = {
  road: "#94a3b8",
  roadClosed: "#d97706",
  candidate: "#cbd5e1",
  baseline: "#64748b",
  recommended: "#0f766e",
  unavailable: "#9ca3af",
  covered: "#0f766e",
  uncovered: "#cbd5e1",
  riskLow: "#fef3c7",
  riskHigh: "#b45309",
  tempEvent: "#d97706",
};

function MapClickHandler({ interactionMode, onMapClick }) {
  useMapEvents({
    click: (e) => {
      if (interactionMode === "tempEvent") {
        onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

function resourceIcon(kind, index) {
  const color =
    kind === "recommended"
      ? COLORS.recommended
      : kind === "unavailable"
      ? COLORS.unavailable
      : COLORS.baseline;
  const ring =
    kind === "recommended"
      ? `<circle cx="16" cy="16" r="13" fill="none" stroke="${color}" stroke-opacity="0.25" stroke-width="6"/>`
      : "";
  const cross =
    kind === "unavailable"
      ? `<line x1="9" y1="9" x2="23" y2="23" stroke="#475569" stroke-width="2.5"/><line x1="23" y1="9" x2="9" y2="23" stroke="#475569" stroke-width="2.5"/>`
      : "";
  const html = `<div style="position:relative;width:32px;height:32px"><svg width="32" height="32" viewBox="0 0 32 32">${ring}<circle cx="16" cy="16" r="9" fill="${color}" stroke="white" stroke-width="2.5"/>${cross}</svg></div>`;
  return L.divIcon({
    html,
    className: "gridaid-resource-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const LAYER_OPTIONS = [
  { key: "roads", label: "Roads" },
  { key: "population", label: "Population" },
  { key: "risk", label: "Transportation Risk" },
  { key: "candidates", label: "Candidate Sites" },
  { key: "resources", label: "Resources" },
  { key: "coverage", label: "Coverage" },
  { key: "disruptions", label: "Disruptions" },
];

export default function MapView({
  layers,
  setLayers,
  selectedIds = [],
  baselineIds = [],
  recommendedIds = [],
  closedRoadId = null,
  unavailableSiteId = null,
  tempEvent = null,
  interactionMode = "none",
  onRoadClick,
  onSiteClick,
  onMapClick,
  thresholdMin = 15,
  assignments = {},
  focus = "population",
}) {
  const [showLayers, setShowLayers] = React.useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const recommendedSet = useMemo(() => new Set(recommendedIds), [recommendedIds]);
  const baselineSet = useMemo(() => new Set(baselineIds), [baselineIds]);

  const coverageRadiusM = (thresholdMin / 60) * 48 * 1.3 * 1000;

  const toggle = (key) =>
    setLayers({ ...layers, [key]: !layers[key] });

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[STUDY_AREA.center.lat, STUDY_AREA.center.lng]}
        zoom={12}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "#f1f5f9" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapClickHandler interactionMode={interactionMode} onMapClick={onMapClick} />

        {/* Roads */}
        {layers.roads &&
          roads.map((road) => {
            const closed = layers.disruptions && closedRoadId === road.id;
            return (
              <Polyline
                key={road.id}
                positions={road.coords.map((c) => [c.lat, c.lng])}
                pathOptions={{
                  color: closed ? COLORS.roadClosed : COLORS.road,
                  weight: closed ? 7 : road.class === "interstate" ? 4 : 3,
                  opacity: closed ? 0.9 : 0.6,
                  dashArray: closed ? "8 6" : undefined,
                }}
                eventHandlers={
                  interactionMode === "roadClosure"
                    ? {
                        click: () => onRoadClick?.(road.id),
                      }
                    : undefined
                }
              >
                <LTooltip>{road.name}{closed ? " — closed" : ""}</LTooltip>
              </Polyline>
            );
          })}

        {/* Coverage circles */}
        {layers.coverage &&
          selectedIds.map((id) => {
            const c = candidates.find((x) => x.id === id);
            if (!c) return null;
            const unavailable = unavailableSiteId === id;
            return (
              <Circle
                key={`cov-${id}`}
                center={[c.lat, c.lng]}
                radius={coverageRadiusM}
                pathOptions={{
                  color: COLORS.recommended,
                  fillColor: COLORS.recommended,
                  fillOpacity: unavailable ? 0.02 : 0.06,
                  weight: 0,
                }}
              />
            );
          })}

        {/* Population / demand */}
        {layers.population &&
          demand.map((d) => {
            const a = assignments[d.id];
            const covered = a ? a.covered : false;
            const weight = focus === "risk" ? d.weightRisk : focus === "balanced" ? d.weightBalanced : d.weightPop;
            const radius = 3 + Math.min(10, Math.sqrt(weight) / 12);
            return (
              <CircleMarker
                key={d.id}
                center={[d.lat, d.lng]}
                radius={radius}
                pathOptions={{
                  color: covered ? COLORS.covered : COLORS.uncovered,
                  fillColor: covered ? COLORS.covered : COLORS.uncovered,
                  fillOpacity: covered ? 0.55 : 0.3,
                  weight: 0.5,
                }}
              />
            );
          })}

        {/* Transportation risk */}
        {layers.risk &&
          demand.map((d) => {
            const r = d.risk;
            // interpolate between riskLow and riskHigh
            const fill = riskColor(r);
            return (
              <CircleMarker
                key={`risk-${d.id}`}
                center={[d.lat, d.lng]}
                radius={5}
                pathOptions={{ color: fill, fillColor: fill, fillOpacity: 0.5, weight: 0.5 }}
              />
            );
          })}

        {/* Candidate sites */}
        {layers.candidates &&
          candidates
            .filter((c) => !selectedSet.has(c.id))
            .map((c) => (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lng]}
                radius={3}
                pathOptions={{ color: COLORS.candidate, fillColor: COLORS.candidate, fillOpacity: 0.5, weight: 0.5 }}
              >
                <LTooltip>Candidate location</LTooltip>
              </CircleMarker>
            ))}

        {/* Selected resources */}
        {layers.resources &&
          selectedIds.map((id, i) => {
            const c = candidates.find((x) => x.id === id);
            if (!c) return null;
            const unavailable = unavailableSiteId === id;
            const kind = unavailable
              ? "unavailable"
              : recommendedSet.has(id)
              ? "recommended"
              : baselineSet.has(id)
              ? "baseline"
              : "recommended";
            return (
              <Marker
                key={id}
                position={[c.lat, c.lng]}
                icon={resourceIcon(kind, i)}
                eventHandlers={{ click: () => onSiteClick?.(id) }}
              >
                <LTooltip>
                  {kind === "recommended" ? "Recommended resource" : kind === "baseline" ? "Starting layout resource" : "Unavailable resource"}
                </LTooltip>
              </Marker>
            );
          })}

        {/* Temporary event */}
        {layers.disruptions && tempEvent && (
          <CircleMarker
            key="temp-event"
            center={[tempEvent.lat, tempEvent.lng]}
            radius={12}
            pathOptions={{ color: COLORS.tempEvent, fillColor: COLORS.tempEvent, fillOpacity: 0.4, weight: 2 }}
          >
            <LTooltip>Temporary event — added demand</LTooltip>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Layers button + panel */}
      <div className="absolute right-3 top-3 z-[500]">
        <button
          onClick={() => setShowLayers((s) => !s)}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent transition-colors"
        >
          <Layers className="h-4 w-4" />
          Layers
        </button>
        {showLayers && (
          <div className="mt-2 w-52 rounded-md border border-border bg-background p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Map Layers</span>
              <button onClick={() => setShowLayers(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1.5">
              {LAYER_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!layers[opt.key]}
                    onChange={() => toggle(opt.key)}
                    className="h-3.5 w-3.5 accent-[#0f766e]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute left-3 bottom-3 z-[500] rounded-md border border-border bg-background/95 p-3 text-xs shadow-lg">
        <div className="mb-1.5 font-medium">Legend</div>
        <div className="space-y-1">
          {layers.resources && (
            <LegendItem color={COLORS.recommended} label="Recommended resource" />
          )}
          {layers.resources && baselineIds.length > 0 && (
            <LegendItem color={COLORS.baseline} label="Starting layout resource" />
          )}
          {layers.resources && unavailableSiteId && (
            <LegendItem color={COLORS.unavailable} label="Unavailable resource" />
          )}
          {layers.candidates && (
            <LegendItem color={COLORS.candidate} label="Candidate site" />
          )}
          {layers.population && (
            <>
              <LegendItem color={COLORS.covered} label="Covered demand" />
              <LegendItem color={COLORS.uncovered} label="Uncovered demand" />
            </>
          )}
          {layers.risk && (
            <>
              <LegendItem color={COLORS.riskLow} label="Lower relative risk" />
              <LegendItem color={COLORS.riskHigh} label="Higher relative risk" />
            </>
          )}
          {layers.disruptions && closedRoadId && (
            <LegendItem color={COLORS.roadClosed} label="Closed road" />
          )}
          {layers.disruptions && tempEvent && (
            <LegendItem color={COLORS.tempEvent} label="Temporary event" />
          )}
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-full border border-black/10"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function riskColor(r) {
  // interpolate from #fef3c7 (low) to #b45309 (high)
  const a = [254, 243, 199];
  const b = [180, 83, 9];
  const t = Math.max(0, Math.min(1, r));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c.join(",")})`;
}