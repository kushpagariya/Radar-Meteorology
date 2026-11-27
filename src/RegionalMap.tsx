import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import { beamHeight, colorFor, nearestGate, PALETTE, type Gate, type Scan } from './data';

/*
 * Regional map: the PPI drawn on a real basemap (Leaflet).
 * Tiles need no API key: Esri Light Gray (map, no labels), Esri World Imagery (satellite), Esri terrain.
 * Place names are shown only on hover unless "Place names" is switched on.
 */

type Props = {
  scan: Scan;
  transform?: (v: number) => number;
  units?: string;
  palette?: string[];
  range?: number;
  min?: number;
  max?: number;
  rings?: boolean;
  threshold?: number | null;
  pin?: Gate | null;
  onPin?: (gate: Gate | null) => void;
  label?: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
};

type Base = 'map' | 'satellite' | 'terrain';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const LIGHT_GRAY = `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;

type BaseDef = {
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  /** CSS class on the tile layer, used for the muted colour treatment. */
  className?: string;
  /** Optional second layer drawn over the base (e.g. greyscale hill shading). */
  overlay?: { url: string; className: string; maxZoom: number };
};

const BASES: Record<Base, BaseDef> = {
  map: {
    label: 'Map',
    url: LIGHT_GRAY,
    attribution: 'Map © Esri, HERE, Garmin, OpenStreetMap contributors',
    maxZoom: 16,
  },
  satellite: {
    label: 'Satellite',
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    className: 'rm-tiles-satellite',
  },
  terrain: {
    label: 'Terrain',
    url: LIGHT_GRAY,
    attribution: 'Map © Esri, HERE, Garmin · Hillshade © Esri, USGS, NASA',
    maxZoom: 16,
    overlay: {
      url: `${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`,
      className: 'rm-tiles-hillshade',
      maxZoom: 16,
    },
  },
};
const LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

/** Towns around the radar (approximate centres, °N, °E). Names appear on hover. */
const PLACES: [string, number, number][] = [
  ['Mahabaleshwar', 17.9237, 73.6586],
  ['Panchgani', 17.9245, 73.8007],
  ['Wai', 17.9524, 73.8916],
  ['Satara', 17.6805, 74.0183],
  ['Karad', 17.2895, 74.184],
  ['Koynanagar', 17.4005, 73.7522],
  ['Chiplun', 17.5319, 73.5151],
  ['Mahad', 18.0836, 73.4166],
  ['Dapoli', 17.7589, 73.1888],
  ['Ratnagiri', 16.9902, 73.312],
  ['Bhor', 18.15, 73.842],
  ['Pune', 18.5204, 73.8567],
  ['Lonavala', 18.7537, 73.4068],
  ['Alibag', 18.6414, 72.8722],
  ['Mumbai', 19.076, 72.8777],
  ['Baramati', 18.1515, 74.5771],
  ['Sangli', 16.8524, 74.5815],
  ['Kolhapur', 16.705, 74.2433],
];

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);
const IMAGE_PX = 1600;
const identity = (v: number) => v;

/** Draws the PPI into a square canvas covering ±range km around the radar. */
function drawPpi(
  canvas: HTMLCanvasElement,
  scan: Scan,
  transform: (v: number) => number,
  range: number,
  min: number,
  max: number,
  palette: string[],
  threshold: number | null,
) {
  canvas.width = canvas.height = IMAGE_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, IMAGE_PX, IMAGE_PX);
  const c = IMAGE_PX / 2,
    scale = c / range;
  for (let ai = 0; ai < scan.azimuths.length; ai++) {
    const az = scan.azimuths[ai],
      next = ai < scan.azimuths.length - 1 ? scan.azimuths[ai + 1] : az + (az - scan.azimuths[ai - 1] || 1);
    const width = (Math.min(3, Math.abs(next - az) || 1) * Math.PI) / 180;
    const angle = (az * Math.PI) / 180 - Math.PI / 2;
    scan.ranges.forEach((r, ri) => {
      const raw = scan.values[ai]?.[ri];
      if (raw == null || r > range) return;
      const inner = (ri ? (scan.ranges[ri - 1] + r) / 2 : Math.max(0, r - (scan.ranges[1] - r) / 2)) * scale;
      const outer =
        (ri < scan.ranges.length - 1 ? (r + scan.ranges[ri + 1]) / 2 : r + (r - scan.ranges[ri - 1]) / 2) * scale;
      ctx.beginPath();
      ctx.arc(c, c, outer, angle - width / 2, angle + width / 2 + 0.003);
      ctx.arc(c, c, inner, angle + width / 2 + 0.003, angle - width / 2, true);
      ctx.closePath();
      ctx.fillStyle = colorFor(transform(raw), min, max, palette);
      ctx.globalAlpha = threshold !== null && raw < threshold ? 0.14 : 1;
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
}

export default function RegionalMap({
  scan,
  transform = identity,
  units = 'dBZ',
  palette = PALETTE,
  range = 150,
  min = 0,
  max = 60,
  rings = true,
  threshold = null,
  pin = null,
  onPin,
  label,
  canvasRef,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const labelLayer = useRef<L.TileLayer | null>(null);
  const radarLayer = useRef<L.ImageOverlay | null>(null);
  const ringLayer = useRef<L.LayerGroup | null>(null);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  const canvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  // Export (PNG) reads the radar image from the shared canvas ref.
  useEffect(() => {
    if (canvasRef) (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas.current;
  }, [canvasRef]);
  const imageUrl = useRef<string | null>(null);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;

  const [base, setBase] = useState<Base>('map');
  const [showNames, setShowNames] = useState(false);
  const [opacity, setOpacity] = useState(0.75);
  const [probe, setProbe] = useState<Gate | null>(null);
  const [cursor, setCursor] = useState<L.LatLng | null>(null);

  const lat0 = scan.latitude,
    lon0 = scan.longitude;
  /** Last gate of the scan: the edge of the radar's coverage (169.8 km for MBL-RADAR). */
  const maxRange = scan.ranges.at(-1) ?? range;
  const toGate = (ll: L.LatLng): Gate => {
    const east = (ll.lng - lon0) * kmPerDegLon(lat0),
      north = (ll.lat - lat0) * KM_PER_DEG_LAT;
    return { range: Math.hypot(east, north), az: ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360 };
  };
  const toLatLng = (g: Gate) => {
    const t = (g.az * Math.PI) / 180;
    return L.latLng(
      lat0 + (Math.cos(t) * g.range) / KM_PER_DEG_LAT,
      lon0 + (Math.sin(t) * g.range) / kmPerDegLon(lat0),
    );
  };
  const radarBounds = () =>
    L.latLngBounds(
      [lat0 - range / KM_PER_DEG_LAT, lon0 - range / kmPerDegLon(lat0)],
      [lat0 + range / KM_PER_DEG_LAT, lon0 + range / kmPerDegLon(lat0)],
    );

  // Create the map once.
  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { zoomControl: false, attributionControl: true, minZoom: 5 });
    m.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright' }).addTo(m);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(m);
    m.fitBounds(radarBounds(), { padding: [10, 10] });
    ringLayer.current = L.layerGroup().addTo(m);
    pinLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base layer.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const b = BASES[base];
    // detectRetina asks for one zoom level finer on high-DPI screens, so tiles stay sharp.
    const opts = { maxZoom: 18, detectRetina: true };
    const layers = [
      L.tileLayer(b.url, { ...opts, attribution: b.attribution, maxNativeZoom: b.maxZoom, className: b.className }),
      ...(b.overlay
        ? [L.tileLayer(b.overlay.url, { ...opts, maxNativeZoom: b.overlay.maxZoom, className: b.overlay.className, opacity: 0.85 })]
        : []),
    ];
    layers.forEach((l) => l.addTo(m));
    layers.slice().reverse().forEach((l) => l.bringToBack());
    return () => layers.forEach((l) => l.remove());
  }, [base]);

  // Optional printed place names (faint).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    labelLayer.current?.remove();
    labelLayer.current = showNames
      ? L.tileLayer(LABELS_URL, { opacity: 0.6, pane: 'shadowPane', maxNativeZoom: 16, maxZoom: 18 }).addTo(m)
      : null;
  }, [showNames]);

  // Town dots: name on hover only.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = L.layerGroup(
      PLACES.map(([name, lat, lon]) =>
        L.circleMarker([lat, lon], {
          radius: 3,
          weight: 1,
          color: '#ffffff',
          fillColor: '#33413d',
          fillOpacity: 0.55,
          opacity: 0.7,
        }).bindTooltip(name, { direction: 'top', offset: [0, -4], className: 'rm-place-tip' }),
      ),
    ).addTo(m);
    return () => {
      group.remove();
    };
  }, []);

  // Radar image overlay.
  useEffect(() => {
    const m = map.current;
    if (!m || !Number.isFinite(lat0) || !Number.isFinite(lon0)) return;
    const c = canvas.current!;
    drawPpi(c, scan, transform, range, min, max, palette, threshold);
    let cancelled = false;
    c.toBlob((blob) => {
      if (!blob || cancelled) return;
      const url = URL.createObjectURL(blob);
      if (radarLayer.current) {
        radarLayer.current.setUrl(url).setBounds(radarBounds());
      } else {
        radarLayer.current = L.imageOverlay(url, radarBounds(), { opacity, interactive: false }).addTo(m);
      }
      if (imageUrl.current) setTimeout(((old) => () => URL.revokeObjectURL(old))(imageUrl.current), 1000);
      imageUrl.current = url;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, transform, range, min, max, palette, threshold, lat0, lon0]);

  useEffect(() => {
    radarLayer.current?.setOpacity(opacity);
  }, [opacity]);

  // Faint range rings, radar site and pinned gate.
  useEffect(() => {
    const g = ringLayer.current;
    if (!g) return;
    g.clearLayers();
    const centre = L.latLng(lat0, lon0);
    if (rings) {
      const step = range > 100 ? 50 : range > 40 ? 20 : range > 10 ? 5 : 1;
      // Regular rings every `step` km, plus a final ring at the edge of the radar's coverage.
      const edge = Math.min(range, maxRange);
      const radii: number[] = [];
      for (let r = step; r <= edge + 1e-6; r += step) radii.push(r);
      if (edge - (radii.at(-1) ?? 0) > step * 0.1) radii.push(Number(edge.toFixed(1)));
      radii.forEach((r, i) => {
        const last = i === radii.length - 1;
        L.circle(centre, {
          radius: r * 1000,
          color: base === 'satellite' ? '#ffffff' : '#33413d',
          weight: last ? 1.4 : 1,
          opacity: (base === 'satellite' ? 0.4 : 0.25) * (last ? 1.5 : 1),
          fill: false,
          interactive: false,
        }).addTo(g);
        L.marker(toLatLng({ az: 0, range: r }), {
          interactive: false,
          icon: L.divIcon({ className: 'rm-ring-label', html: `${r} km`, iconSize: [52, 14], iconAnchor: [-4, 7] }),
        }).addTo(g);
      });
    }
    L.circleMarker(centre, { radius: 4, weight: 2, color: '#ffffff', fillColor: '#1f6a70', fillOpacity: 1 })
      .bindTooltip('Mahabaleshwar radar', { direction: 'top', offset: [0, -5], className: 'rm-place-tip' })
      .addTo(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rings, range, maxRange, lat0, lon0, base]);

  useEffect(() => {
    const g = pinLayer.current;
    if (!g) return;
    g.clearLayers();
    if (!pin || pin.range > range) return;
    L.polyline([L.latLng(lat0, lon0), toLatLng({ az: pin.az, range })], {
      color: '#ffffff',
      weight: 1,
      opacity: 0.6,
      dashArray: '3 5',
      interactive: false,
    }).addTo(g);
    L.circleMarker(toLatLng(pin), { radius: 6, weight: 2, color: '#1e3f3f', fillColor: '#ffffff', fillOpacity: 1 }).addTo(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, range, lat0, lon0]);

  // Hover readout and click-to-pin.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const move = (e: L.LeafletMouseEvent) => {
      setCursor(e.latlng);
      const g = toGate(e.latlng);
      setProbe(g.range > range ? null : g);
    };
    const out = () => {
      setProbe(null);
      setCursor(null);
    };
    const click = (e: L.LeafletMouseEvent) => {
      const g = toGate(e.latlng);
      onPinRef.current?.(
        g.range > range ? null : { az: Math.round(g.az * 10) / 10, range: Math.round(g.range * 100) / 100 },
      );
    };
    m.on('mousemove', move).on('mouseout', out).on('click', click);
    return () => {
      m.off('mousemove', move).off('mouseout', out).off('click', click);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, lat0, lon0]);

  const readout = probe ?? pin;
  const idx = readout ? nearestGate(scan, readout) : null;
  const raw = idx ? (scan.values[idx.ai]?.[idx.ri] ?? null) : null;
  const height = readout ? beamHeight(readout.range, scan.elevation) : null;

  return (
    <div className={`regional-map base-${base}`}>
      <div ref={host} className="regional-map-canvas" aria-label="Regional map with radar overlay" />
      <div className="rm-controls">
        <div className="rm-bases" role="group" aria-label="Map type">
          {(Object.keys(BASES) as Base[]).map((b) => (
            <button key={b} aria-pressed={base === b} onClick={() => setBase(b)}>
              {BASES[b].label}
            </button>
          ))}
        </div>
        <label className="rm-check">
          <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
          Place names
        </label>
        <label className="rm-opacity">
          Radar
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            aria-label="Radar layer opacity"
          />
        </label>
        <button
          className="rm-recenter"
          onClick={() => map.current?.fitBounds(radarBounds(), { padding: [10, 10] })}
          title="Recenter on radar"
          aria-label="Recenter on radar"
        >
          <Crosshair size={15} />
        </button>
      </div>
      <div className="plot-readout rm-readout" aria-live="polite">
        {readout ? (
          <>
            <span>
              {!probe && pin ? 'Pinned · ' : ''}
              {raw === null ? 'No data' : `${transform(raw).toFixed(1)} ${units}`}
            </span>
            <span>
              {readout.az.toFixed(1)}° / {readout.range.toFixed(1)} km
              {height !== null && ` · beam ${height.toFixed(2)} km`}
              {cursor && ` · ${cursor.lat.toFixed(3)}° N, ${cursor.lng.toFixed(3)}° E`}
            </span>
          </>
        ) : (
          <>
            <span>{label ?? 'Radar scan'}</span>
            <span>Drag to pan · scroll to zoom · click to pin a gate</span>
          </>
        )}
      </div>
    </div>
  );
}
