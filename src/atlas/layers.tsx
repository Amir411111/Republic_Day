import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification } from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';
import { geoUrl } from '../map/styles';
import type { Period } from './periods';

// Wider, softer edge where the outline is an approximation
const EDGE_BLUR: ExpressionSpecification = ['case', ['get', 'approximate'], 4, 0.6];
const EDGE_WIDTH: ExpressionSpecification = ['case', ['get', 'approximate'], 1.2, 1.8];
const EDGE_OPACITY: ExpressionSpecification = ['case', ['get', 'approximate'], 0.55, 0.9];
const FADE = { duration: 700, delay: 0 };
const ROUND = { 'line-join': 'round', 'line-cap': 'round' } as const;

// The era's territory as a zone of influence. Source and layer ids stay the same across eras,
// so MapLibre cross-fades one era into the next instead of popping.
export function EraOverlay({ period }: { period: Period }) {
  return (
    <Source id="era-overlay" type="geojson" data={geoUrl(`eras/${period.id}.geojson`)}>
      <Layer
        id="era-fill"
        type="fill"
        paint={{ 'fill-color': period.color, 'fill-opacity': 0.2, 'fill-color-transition': FADE, 'fill-opacity-transition': FADE }}
      />
      <Layer
        id="era-glow"
        type="line"
        paint={{ 'line-color': period.color, 'line-width': 12, 'line-blur': 12, 'line-opacity': 0.35 }}
        layout={ROUND}
      />
      <Layer
        id="era-edge"
        type="line"
        paint={{ 'line-color': period.color, 'line-width': EDGE_WIDTH, 'line-blur': EDGE_BLUR, 'line-opacity': EDGE_OPACITY }}
        layout={ROUND}
      />
    </Source>
  );
}

// Today's border on every era: without it there is nothing to measure a historical territory against.
// A dark casing under a dashed light line stays visible over both desert and mountains.
export function CountryOutline() {
  return (
    <Source id="kz-modern" type="geojson" data={geoUrl('kz-modern.geojson')}>
      <Layer
        id="kz-modern-casing"
        type="line"
        paint={{ 'line-color': '#04070e', 'line-width': 3.4, 'line-opacity': 0.55, 'line-blur': 1.2 }}
        layout={ROUND}
      />
      <Layer
        id="kz-modern-line"
        type="line"
        paint={{ 'line-color': '#e9eef7', 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [3, 2.2] }}
        layout={ROUND}
      />
    </Source>
  );
}

// Today's Kazakhstan picked out inside an empire. It lay entirely inside the Russian Empire
// and the USSR, so the intersection is simply the modern outline.
const SKY = '#5fb3e0';

export function ModernWithin() {
  return (
    <Source id="kz-within" type="geojson" data={geoUrl('kz-modern.geojson')}>
      <Layer id="kz-within-fill" type="fill" paint={{ 'fill-color': SKY, 'fill-opacity': 0.22 }} />
      <Layer id="kz-within-line" type="line" paint={{ 'line-color': SKY, 'line-width': 2, 'line-opacity': 0.95 }} layout={ROUND} />
    </Source>
  );
}

export const REGION_LAYER_ID = 'kz-regions-extrusion';

// Regions raised as blocks: at country zoom one pixel is ~10 km, so heights must be large to read
const TONES = ['#2b3f63', '#38547f', '#243551', '#43608d', '#2f4a73', '#1f2f49'];
const REGION_IDS = [
  'akmola', 'aktobe', 'almaty', 'atyrau', 'karaganda', 'kostanay', 'kyzylorda',
  'mangystau', 'pavlodar', 'severo', 'turkestan', 'vostochno', 'zapadno', 'zhambyl',
];
const TONE_MATCH = [
  'match',
  ['get', 'id'],
  ...REGION_IDS.flatMap((id, i) => [id, TONES[i % TONES.length]]),
  TONES[0],
] as unknown as ExpressionSpecification;

export function RegionsLayer({ selectedId }: { selectedId: string | null }) {
  const isSelected: ExpressionSpecification = ['==', ['get', 'id'], selectedId ?? '\u0000'];
  const isCity: ExpressionSpecification = ['==', ['get', 'kind'], 'city'];
  return (
    <Source id="kz-regions" type="geojson" data={geoUrl('kz-regions.geojson')} promoteId="id">
      <Layer
        id={REGION_LAYER_ID}
        type="fill-extrusion"
        paint={{
          'fill-extrusion-color': ['case', isSelected, '#d8af4f', isCity, SKY, TONE_MATCH],
          'fill-extrusion-height': ['case', isSelected, 300000, isCity, 260000, 150000],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82,
          'fill-extrusion-vertical-gradient': true,
        }}
      />
      <Layer
        id="kz-regions-outline"
        type="line"
        paint={{ 'line-color': '#070d18', 'line-width': ['case', isSelected, 1.6, 0.8], 'line-opacity': 0.75 }}
      />
    </Source>
  );
}

export const MONUMENT_LAYER_ID = 'monuments';

// Classes from the Law on historical and cultural heritage; set by scripts/import_monuments.py
export const MONUMENT_KINDS = ['archaeology', 'architecture', 'monumental', 'ensemble', 'sacral', 'history', 'other'] as const;
export type MonumentKind = (typeof MONUMENT_KINDS)[number];

// Distinct in hue and lightness, readable over both desert and mountains
export const MONUMENT_COLORS: Record<MonumentKind, string> = {
  archaeology: '#e0a458',
  architecture: '#5fb3e0',
  monumental: '#e46f93',
  ensemble: '#a597f2',
  sacral: '#4fbf98',
  history: '#e9eef7',
  other: '#93a3bd',
};

const COLOR_BY_KIND = [
  'match',
  ['get', 'kind'],
  ...MONUMENT_KINDS.flatMap((k) => [k, MONUMENT_COLORS[k]]),
  MONUMENT_COLORS.other,
] as unknown as ExpressionSpecification;

// One GeoJSON layer, filtered on the GPU instead of DOM markers.
// Approximate sites (placed at a settlement or street, not the object) are drawn as hollow rings.
export function MonumentsLayer({
  data,
  kinds,
  showApprox,
}: {
  data: FeatureCollection;
  kinds: MonumentKind[];
  showApprox: boolean;
}) {
  const approx: ExpressionSpecification = ['==', ['get', 'approx'], true];
  const byKind: ExpressionSpecification = ['in', ['get', 'kind'], ['literal', kinds]];
  return (
    <Source id="monuments-src" type="geojson" data={data}>
      <Layer
        id={MONUMENT_LAYER_ID}
        type="circle"
        filter={showApprox ? byKind : ['all', byKind, ['!', approx]]}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 8, 7, 12, 10],
          'circle-color': COLOR_BY_KIND,
          'circle-opacity': ['case', approx, 0.15, 0.9],
          'circle-stroke-color': ['case', approx, COLOR_BY_KIND, '#070d18'],
          'circle-stroke-width': ['case', approx, 1.8, 1.2],
        }}
      />
    </Source>
  );
}

export const EVENT_LAYER_ID = 'items-event';
export const PHOTO_LAYER_ID = 'items-photo';

// A lozenge, as in Kazakh ornament, as a signed-distance image: drawn and coloured on the GPU
// like any other layer, instead of one DOM element per point moved on every frame.
const DIAMOND = (() => {
  const size = 48;
  const c = (size - 1) / 2;
  const r = size * 0.36;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - c) + Math.abs(y - c);
      // MapLibre reads the alpha of an SDF image as distance: 192 is the edge
      data[(y * size + x) * 4 + 3] = Math.max(0, Math.min(255, Math.round(192 + (r - d) * 16)));
    }
  return { width: size, height: size, data };
})();

export function addMapImages(map: { hasImage(id: string): boolean; addImage(id: string, img: typeof DIAMOND, o: { sdf: boolean }): void }) {
  if (!map.hasImage('diamond')) map.addImage('diamond', DIAMOND, { sdf: true });
}

// Events and photos of the current era. `active` marks the selected point.
export function ItemsLayer({ data, color }: { data: FeatureCollection; color: string }) {
  const active: ExpressionSpecification = ['==', ['get', 'active'], true];
  return (
    <Source id="items" type="geojson" data={data}>
      {/* a thin ring around events whose exact site is unknown */}
      <Layer
        id="items-approx"
        type="circle"
        filter={['all', ['==', ['get', 'kind'], 'event'], ['==', ['get', 'approx'], true]]}
        paint={{ 'circle-radius': 14, 'circle-opacity': 0, 'circle-stroke-color': color, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.7 }}
      />
      <Layer
        id={PHOTO_LAYER_ID}
        type="circle"
        filter={['==', ['get', 'kind'], 'photo']}
        paint={{
          'circle-radius': ['case', active, 7, 4.5],
          'circle-color': '#e9eef7',
          'circle-stroke-color': color,
          'circle-stroke-width': 2,
        }}
      />
      <Layer
        id={EVENT_LAYER_ID}
        type="symbol"
        filter={['==', ['get', 'kind'], 'event']}
        layout={{
          'icon-image': 'diamond',
          'icon-size': ['case', active, 0.75, 0.5],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['case', active, 1, 0],
        }}
        paint={{
          'icon-color': ['case', active, color, 'rgba(7,13,24,0.85)'],
          'icon-halo-color': color,
          'icon-halo-width': 2.5,
        }}
      />
    </Source>
  );
}
