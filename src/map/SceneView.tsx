import Map, { AttributionControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '../game/types';
import { TERRAIN_STYLE } from './styles';

// Deterministic camera angle from the id, so the same place never spins between renders
function bearingFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 3600;
  return hash / 10 - 180;
}

// The place itself in 3D: this is the question. Interaction is off, because panning out
// would let the player read the surrounding geography instead of recognising the spot.
export default function SceneView({ id, at }: { id: string; at: LatLng }) {
  return (
    <Map
      // a fresh camera per round instead of a visible flight that would leak the distance
      key={id}
      mapStyle={TERRAIN_STYLE}
      initialViewState={{ longitude: at.lng, latitude: at.lat, zoom: 11.8, pitch: 58, bearing: bearingFor(id) }}
      interactive={false}
      attributionControl={false}
      style={{ position: 'absolute', inset: 0 }}
    >
      <AttributionControl position="bottom-left" compact />
    </Map>
  );
}
