import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre 6 looks for its worker next to its own chunk, where Vite does not emit it;
// point it at the copy Vite does emit. Every map component imports this module.
setWorkerUrl(workerUrl);

// Keyless basemaps only: the demo must work on a conference network with no setup.

const GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

const ESRI = {
  type: 'raster' as const,
  tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  maxzoom: 17,
  attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
};

const BACKGROUND = { id: 'background', type: 'background' as const, paint: { 'background-color': '#070d18' } };

// Satellite imagery over real elevation, darkened so era colours and panels stay readable on a projector
export const TERRAIN_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    satellite: ESRI,
    terrain: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      // relief at country and region zoom does not need street-level elevation; fewer tiles to decode
      maxzoom: 11,
      attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
    },
  },
  layers: [
    BACKGROUND,
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      paint: { 'raster-opacity': 0.88, 'raster-saturation': -0.55, 'raster-brightness-max': 0.74, 'raster-contrast': 0.08 },
    },
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: {
        'hillshade-exaggeration': 0.42,
        'hillshade-shadow-color': '#04070e',
        'hillshade-highlight-color': '#e6c88a',
        'hillshade-accent-color': '#0b1220',
      },
    },
  ],
  terrain: { source: 'terrain', exaggeration: 1.4 },
  sky: {
    'sky-color': '#0d1a30',
    'horizon-color': '#1d2d4a',
    'fog-color': '#070d18',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.4,
  },
};

// The same imagery without 3D relief: for weaker devices, toggled on the history map
export const FLAT_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: { satellite: ESRI },
  layers: [TERRAIN_STYLE.layers[0], TERRAIN_STYLE.layers[1]],
};

// Rendering above 1.5x pixel density costs up to 4x the GPU work on retina screens for little visible gain
export const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.5);

// The guessing map carries no place names at any zoom: on a guessing map a label is the answer
export const GUESS_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: { base: { ...ESRI, maxzoom: 16 } },
  layers: [
    BACKGROUND,
    {
      id: 'base',
      type: 'raster',
      source: 'base',
      paint: { 'raster-opacity': 0.78, 'raster-saturation': -0.7, 'raster-brightness-max': 0.66, 'raster-contrast': 0.1 },
    },
  ],
};

// Street map with names, for the walking quest where streets matter
export const STREET_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    BACKGROUND,
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-brightness-max': 0.92, 'raster-saturation': -0.25 } },
  ],
};

// Opening view of the guessing map: the whole country
export const KZ_VIEW = { longitude: 67.5, latitude: 48.2, zoom: 3.1 };

// The history map camera never needs to leave this box: [west, south, east, north]
export const KZ_BOUNDS: [number, number, number, number] = [40, 34, 96, 60];

export const geoUrl = (file: string) => `${import.meta.env.BASE_URL}geo/${file}`;
