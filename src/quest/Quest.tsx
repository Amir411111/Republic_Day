import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import raw from '../../content/quest-semey.json';
import type { L10n, LatLng } from '../game/types';
import { useI18n } from '../i18n';
import { distanceKm } from '../map/distance';

interface Stop {
  id: string;
  lat: number;
  lng: number;
  title: L10n;
  story: L10n;
  question: L10n;
  // Either the same labels in every language, or per-language labels
  options: string[] | Record<string, string[]>;
  answer: number;
  sources: string[];
}

const STOPS = raw as Stop[];
const KEY = 'tg_quest_semey_v1';
const NEAR_METERS = 150;

function loadDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function saveDone(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

export default function Quest() {
  const { t, l, lang } = useI18n();
  const [done, setDone] = useState<string[]>(loadDone);
  const [wrong, setWrong] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [geoMsg, setGeoMsg] = useState('');

  useEffect(() => saveDone(done), [done]);

  const stamp = (id: string) => setDone((d) => (d.includes(id) ? d : [...d, id]));

  const locate = (stop: Stop) => {
    if (!navigator.geolocation) {
      setGeoMsg(t('questNoGeo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        const m = Math.round(distanceKm(here, stop) * 1000);
        if (m <= NEAR_METERS) {
          stamp(stop.id);
          setGeoMsg('');
        } else setGeoMsg(t('questTooFar', { n: m }));
      },
      () => setGeoMsg(t('questNoGeo')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const optionsOf = (s: Stop) => (Array.isArray(s.options) ? s.options : s.options[lang] ?? s.options.ru);
  const finished = done.length === STOPS.length;

  return (
    <div className="screen quest">
      <h1>{t('questTitle')}</h1>
      <p className="lead">{t('questLead')}</p>
      <p className="big">{t('questProgress', { n: done.length, total: STOPS.length })}</p>
      {finished && <p className="done-banner">🏅 {t('questFinished')}</p>}

      <MapContainer center={[50.403, 80.25]} zoom={14} className="map" scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline positions={STOPS.map((s) => [s.lat, s.lng] as [number, number])} pathOptions={{ color: '#0b6e4f', dashArray: '6 8', weight: 3 }} />
        {STOPS.map((s, i) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={13}
            pathOptions={{ color: '#fff', weight: 3, fillColor: done.includes(s.id) ? '#1a8f3c' : '#b5651d', fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top">
              {i + 1}
            </Tooltip>
          </CircleMarker>
        ))}
        {me && <CircleMarker center={[me.lat, me.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2a6fdb', fillOpacity: 1 }} />}
      </MapContainer>
      {geoMsg && <p className="warn">{geoMsg}</p>}

      <ol className="stops">
        {STOPS.map((s, i) => {
          const isDone = done.includes(s.id);
          return (
            <li key={s.id} className={isDone ? 'stop done' : 'stop'}>
              <h2>
                {i + 1}. {l(s.title)} {isDone && '✅'}
              </h2>
              <p className="explanation">{l(s.story)}</p>
              {!isDone && (
                <>
                  <h3>{l(s.question)}</h3>
                  <div className="menu">
                    {optionsOf(s).map((o, k) => (
                      <button
                        key={o}
                        type="button"
                        className="secondary"
                        onClick={() => {
                          if (k === s.answer) {
                            stamp(s.id);
                            setWrong(null);
                          } else setWrong(s.id);
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  {wrong === s.id && <p className="warn">{t('questWrong')}</p>}
                  <button type="button" className="link-btn" onClick={() => locate(s)}>
                    📍 {t('questImHere')}
                  </button>
                </>
              )}
              <p className="credit">
                {t('sources')}:{' '}
                {s.sources.map((u, k) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    [{k + 1}]{' '}
                  </a>
                ))}
              </p>
            </li>
          );
        })}
      </ol>
      {done.length > 0 && (
        <button type="button" className="secondary" onClick={() => setDone([])}>
          {t('questReset')}
        </button>
      )}
    </div>
  );
}
