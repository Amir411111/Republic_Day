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

// ~600 open-data points: one GeoJSON layer instead of DOM markers
export function MonumentsLayer({ data }: { data: FeatureCollection }) {
  return (
    <Source id="monuments-src" type="geojson" data={data}>
      <Layer
        id={MONUMENT_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 8, 5, 12, 8],
          'circle-color': '#cfd8e6',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#070d18',
          'circle-stroke-width': 1,
        }}
      />
    </Source>
  );
}
