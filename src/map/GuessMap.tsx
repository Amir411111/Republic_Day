import { useEffect, useRef } from 'react';
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '../game/types';
import { GUESS_STYLE, KZ_VIEW, geoUrl } from './styles';

interface Props {
  guess: LatLng | null;
  // set once the round is answered: the map switches to showing the answer and the gap
  answer?: LatLng | null;
  onGuess?: (p: LatLng) => void;
  guessLabel: string;
  answerLabel: string;
}

export default function GuessMap({ guess, answer, onGuess, guessLabel, answerLabel }: Props) {
  const ref = useRef<MapRef | null>(null);
  const revealed = !!answer;

  // Frame both pins once the answer is in, so the gap is visible at a glance
  useEffect(() => {
    const map = ref.current?.getMap();
    if (!map) return;
    if (!answer) {
      // next round: back to the whole country
      map.easeTo({ center: [KZ_VIEW.longitude, KZ_VIEW.latitude], zoom: KZ_VIEW.zoom, duration: 600 });
      return;
    }
    if (!guess) {
      map.flyTo({ center: [answer.lng, answer.lat], zoom: 5, duration: 1000 });
      return;
    }
    map.fitBounds(
      [
        [Math.min(guess.lng, answer.lng), Math.min(guess.lat, answer.lat)],
        [Math.max(guess.lng, answer.lng), Math.max(guess.lat, answer.lat)],
      ],
      { padding: 64, duration: 1200, maxZoom: 7 },
    );
  }, [answer, guess]);

  const line =
    guess && answer
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [guess.lng, guess.lat],
              [answer.lng, answer.lat],
            ],
          },
        }
      : null;

  return (
    <Map
      ref={ref}
      mapStyle={GUESS_STYLE}
      initialViewState={KZ_VIEW}
      minZoom={2}
      maxZoom={11}
      dragRotate={false}
      attributionControl={false}
      cursor={revealed ? 'grab' : 'crosshair'}
      onClick={(e) => {
        if (!revealed && onGuess) onGuess({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl position="bottom-right" compact />

      {/* the country, so there is something to aim at on a label-free map */}
      <Source id="guess-kz" type="geojson" data={geoUrl('kz-modern.geojson')}>
        <Layer id="guess-kz-fill" type="fill" paint={{ 'fill-color': '#5fb3e0', 'fill-opacity': 0.07 }} />
        <Layer id="guess-kz-line" type="line" paint={{ 'line-color': '#5fb3e0', 'line-width': 1.4, 'line-opacity': 0.7 }} />
      </Source>

      {line && (
        <Source id="guess-line" type="geojson" data={line}>
          <Layer
            id="guess-line-stroke"
            type="line"
            paint={{ 'line-color': '#e9eef7', 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [2, 1.6] }}
          />
        </Source>
      )}

      {guess && (
        <Marker longitude={guess.lng} latitude={guess.lat} anchor="center">
          <span
            aria-label={guessLabel}
            title={guessLabel}
            className="block size-4 rotate-45 rounded-[3px] border-2 border-[#e9eef7] bg-[#c45b7c]"
          />
        </Marker>
      )}

      {answer && (
        <Marker longitude={answer.lng} latitude={answer.lat} anchor="center">
          <span
            aria-label={answerLabel}
            title={answerLabel}
            className="block size-4 rotate-45 rounded-[3px] border-2 border-[#d8af4f] bg-[#d8af4f] shadow-[0_0_0_6px_rgba(216,175,79,0.22)]"
          />
        </Marker>
      )}
    </Map>
  );
}
