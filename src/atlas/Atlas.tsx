import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { ALL_CARDS, imageUrl, isVerified } from '../game/cards';
import { YEAR_MAX, YEAR_MIN } from '../game/scoring';
import type { Card, L10n } from '../game/types';
import Guide from '../guide/Guide';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { KZ_BOUNDS } from '../map/GuessMap';
import { ERAS, EVENTS, eraColor, eraOfYear, yearLabel, type Era, type HistEvent } from './events';

interface Monument {
  id: number;
  lat: number;
  lng: number;
  name: { kk: string; ru: string };
  type: { kk: string; ru: string };
  district: { kk: string; ru: string };
}

const MONUMENTS_SOURCE = 'https://data.egov.kz/datasets/view?index=respublikalyk_manyzy_bar_tarih';

// One list for both layers: text events and photo cards share the map and the timeline
interface Item {
  key: string;
  kind: 'event' | 'photo';
  era: Era;
  year: number;
  year_end?: number;
  lat: number;
  lng: number;
  approx: boolean;
  title: L10n;
  place: L10n;
  text: L10n;
  sources: string[];
  card?: Card;
  image?: string;
  credit?: { author: string; license: string; source_url: string };
}

const fromEvent = (e: HistEvent): Item => ({
  key: `e:${e.id}`,
  kind: 'event',
  era: e.era,
  year: e.year,
  year_end: e.year_end,
  lat: e.lat,
  lng: e.lng,
  approx: e.approx,
  title: e.title,
  place: e.place,
  text: e.text,
  sources: e.sources,
  image: e.image,
  credit: e.image_credit,
});

const fromCard = (c: Card): Item => ({
  key: `p:${c.id}`,
  kind: 'photo',
  era: eraOfYear(c.year),
  year: c.year,
  lat: c.lat,
  lng: c.lng,
  approx: false,
  title: c.title,
  place: c.place,
  text: c.explanation,
  sources: c.sources,
  card: c,
  image: c.image,
  credit: c.image_credit,
});

const ERA_KEYS: Record<Era, StringKey> = {
  khanate: 'eraKhanate',
  empire: 'eraEmpire',
  soviet: 'eraSoviet',
  independence: 'eraIndependence',
};

function FlyTo({ item }: { item: Item | null }) {
  const map = useMap();
  useEffect(() => {
    if (item) map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
  }, [item, map]);
  return null;
}

export default function Atlas() {
  const { t, l, lang } = useI18n();
  const [showEvents, setShowEvents] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [era, setEra] = useState<Era | 'all'>('all');
  const [upTo, setUpTo] = useState(YEAR_MAX);
  const [selected, setSelected] = useState<Item | null>(null);
  const [showMon, setShowMon] = useState(false);
  const [monuments, setMonuments] = useState<Monument[] | null>(null);
  const [mon, setMon] = useState<Monument | null>(null);

  // 600 points from the open data portal: loaded only when the layer is switched on
  useEffect(() => {
    if (showMon && !monuments)
      import('../../content/monuments-kostanay.json').then((m) => setMonuments(m.default as Monument[]));
  }, [showMon, monuments]);
  const ml = (x: { kk: string; ru: string }) => (lang === 'kk' ? x.kk : x.ru) || x.ru || x.kk;

  const all = useMemo(
    () =>
      [...EVENTS.map(fromEvent), ...ALL_CARDS.filter(isVerified).map(fromCard)].sort(
        (a, b) => a.year - b.year || (a.kind === 'event' ? -1 : 1),
      ),
    [],
  );

  const visible = all.filter(
    (i) =>
      (i.kind === 'event' ? showEvents : showPhotos) && (era === 'all' || i.era === era) && i.year <= upTo,
  );

  const select = (i: Item) => {
    setSelected(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="screen atlas">
      <h1>{t('atlasTitle')}</h1>
      <p className="lead">{t('atlasLead')}</p>

      <div className="toggle wrap">
        <button type="button" className={showEvents ? 'on' : ''} onClick={() => setShowEvents(!showEvents)}>
          {t('layerEvents')}
        </button>
        <button type="button" className={showPhotos ? 'on' : ''} onClick={() => setShowPhotos(!showPhotos)}>
          {t('layerPhotos')}
        </button>
        <button type="button" className={showMon ? 'on' : ''} onClick={() => setShowMon(!showMon)}>
          {t('layerMonuments')}
        </button>
      </div>

      <div className="toggle wrap eras">
        <button type="button" className={era === 'all' ? 'on' : ''} onClick={() => setEra('all')}>
          {t('eraAll')}
        </button>
        {ERAS.map((e) => (
          <button key={e.id} type="button" className={era === e.id ? 'on' : ''} onClick={() => setEra(e.id)}>
            <span className="dot" style={{ background: e.color }} /> {t(ERA_KEYS[e.id])}
          </button>
        ))}
      </div>

      <div className="year-picker">
        <label htmlFor="upto">
          {t('upToYear')} <strong className="year-value">{upTo}</strong>
        </label>
        <input
          id="upto"
          type="range"
          min={YEAR_MIN + 60}
          max={YEAR_MAX}
          value={upTo}
          onChange={(e) => setUpTo(Number(e.target.value))}
        />
      </div>

      <MapContainer bounds={KZ_BOUNDS} className="map atlas-map" scrollWheelZoom preferCanvas>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <FlyTo item={selected} />
        {showMon &&
          monuments?.map((m) => (
            <CircleMarker
              key={`m${m.id}`}
              center={[m.lat, m.lng]}
              radius={4}
              pathOptions={{ color: '#555', weight: 1, fillColor: '#999', fillOpacity: 0.8 }}
              eventHandlers={{ click: () => setMon(m) }}
            />
          ))}
        {visible.map((i) => {
          const color = eraColor(i.era);
          const isSel = selected?.key === i.key;
          return (
            <CircleMarker
              key={i.key}
              center={[i.lat, i.lng]}
              radius={i.kind === 'event' ? (isSel ? 13 : 10) : isSel ? 10 : 7}
              pathOptions={
                i.kind === 'event'
                  ? { color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95, dashArray: i.approx ? '4 3' : undefined }
                  : { color, weight: 3, fillColor: '#fff', fillOpacity: 1 }
              }
              eventHandlers={{ click: () => select(i) }}
            >
              <Tooltip>
                {yearLabel(i)} · {l(i.title)}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="hint">{t('atlasLegend')}</p>
      {showMon && (
        <p className="hint">
          {t('monumentsNote')}{' '}
          <a href={MONUMENTS_SOURCE} target="_blank" rel="noreferrer">
            data.egov.kz
          </a>
          {monuments ? ` · ${monuments.length}` : ' …'}
        </p>
      )}
      {mon && (
        <article className="detail" style={{ borderColor: '#777' }}>
          <div className="detail-head">
            <span className="big">{ml(mon.type)}</span>
            <button type="button" className="secondary" onClick={() => setMon(null)}>
              {t('close')}
            </button>
          </div>
          <h2>{ml(mon.name)}</h2>
          <p className="place">{ml(mon.district)}</p>
          <p className="credit">
            {t('monumentsSource')}:{' '}
            <a href={MONUMENTS_SOURCE} target="_blank" rel="noreferrer">
              data.egov.kz
            </a>
          </p>
        </article>
      )}

      {selected && (
        <article className="detail" style={{ borderColor: eraColor(selected.era) }}>
          <div className="detail-head">
            <span className="big">{yearLabel(selected)}</span>
            <button type="button" className="secondary" onClick={() => setSelected(null)}>
              {t('close')}
            </button>
          </div>
          <h2>{l(selected.title)}</h2>
          <p className="place">
            {l(selected.place)}
            {selected.approx && <em> · {t('approxPlace')}</em>}
          </p>
          {selected.image && (
            <img className="photo" src={imageUrl({ image: selected.image } as Card)} alt={l(selected.title)} />
          )}
          <p className="explanation">{l(selected.text)}</p>
          <h3>{t('sources')}</h3>
          <ul className="sources">
            {selected.sources.map((s) => (
              <li key={s}>
                <a href={s} target="_blank" rel="noreferrer">
                  {s}
                </a>
              </li>
            ))}
          </ul>
          <details className="ask-guide">
            <summary>💬 {t('guideAskAbout')}</summary>
            <Guide key={selected.key} focus={selected.key} compact />
          </details>
          {selected.image && selected.credit && (
            <p className="credit">
              {t('imageBy')}: {selected.credit.author} ·{' '}
              <a href={selected.credit.source_url} target="_blank" rel="noreferrer">
                {selected.credit.license}
              </a>
            </p>
          )}
        </article>
      )}

      <h3>
        {t('timeline')} ({visible.length})
      </h3>
      <ol className="timeline">
        {visible.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              className={selected?.key === i.key ? 'on' : ''}
              style={{ borderLeftColor: eraColor(i.era) }}
              onClick={() => select(i)}
            >
              <span className="t-year">{yearLabel(i)}</span>
              <span className="t-title">
                {i.kind === 'photo' && '📷 '}
                {l(i.title)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
