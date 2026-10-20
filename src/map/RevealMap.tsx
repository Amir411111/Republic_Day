import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type { LatLng } from '../game/types';
import { KZ_BOUNDS } from './GuessMap';

interface Props {
  guess: LatLng;
  answer: LatLng;
  km: number;
  guessLabel: string;
  answerLabel: string;
}

export default function RevealMap({ guess, answer, km, guessLabel, answerLabel }: Props) {
  // Zoom to both points, but never tighter than a city-level view
  const pad = 1.5;
  const bounds: [[number, number], [number, number]] =
    km < 5
      ? KZ_BOUNDS
      : [
          [Math.min(guess.lat, answer.lat) - pad, Math.min(guess.lng, answer.lng) - pad],
          [Math.max(guess.lat, answer.lat) + pad, Math.max(guess.lng, answer.lng) + pad],
        ];

  return (
    <MapContainer bounds={bounds} className="map">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Polyline
        positions={[
          [guess.lat, guess.lng],
          [answer.lat, answer.lng],
        ]}
        pathOptions={{ color: '#333', dashArray: '8 8', weight: 3 }}
      >
        <Tooltip permanent direction="center">
          {Math.round(km)} km
        </Tooltip>
      </Polyline>
      <CircleMarker
        center={[guess.lat, guess.lng]}
        radius={11}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#d33', fillOpacity: 1 }}
      >
        <Tooltip>{guessLabel}</Tooltip>
      </CircleMarker>
      <CircleMarker
        center={[answer.lat, answer.lng]}
        radius={11}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#1a8f3c', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top">
          {answerLabel}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
