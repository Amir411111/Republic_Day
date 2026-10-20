import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLng } from '../game/types';

// Rough bounding box of Kazakhstan: whole country fits on load
export const KZ_BOUNDS: [[number, number], [number, number]] = [
  [40.5, 46.5],
  [55.5, 87.5],
];

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';

function ClickHandler({ onGuess }: { onGuess: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onGuess({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

interface Props {
  value: LatLng | null;
  onGuess: (p: LatLng) => void;
}

export default function GuessMap({ value, onGuess }: Props) {
  return (
    <MapContainer bounds={KZ_BOUNDS} className="map" scrollWheelZoom>
      <TileLayer url={TILES} attribution={ATTRIBUTION} />
      <ClickHandler onGuess={onGuess} />
      {value && (
        <CircleMarker
          center={[value.lat, value.lng]}
          radius={12}
          pathOptions={{ color: '#fff', weight: 3, fillColor: '#d33', fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
