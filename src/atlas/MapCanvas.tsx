import { useEffect, useRef, useState, type ReactNode } from 'react';
import Map, { AttributionControl, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useI18n } from '../i18n';
import { FLAT_STYLE, KZ_BOUNDS, PIXEL_RATIO, TERRAIN_STYLE } from '../map/styles';
import { addMapImages } from './layers';
import type { Period } from './periods';

type Status = 'loading' | 'ready' | 'failed';

export interface Camera {
  center: [number, number];
  zoom: number;
}

interface Props {
  period: Period;
  interactiveLayerIds?: string[];
  onFeatureClick?: (layerId: string | null, properties: Record<string, unknown> | null) => void;
  // overrides the era camera, e.g. when a point or a region is selected
  flyTo?: Camera | null;
  // 3D relief; off on weaker devices
  terrain: boolean;
  children?: ReactNode;
}

export default function MapCanvas({ period, interactiveLayerIds, onFeatureClick, flyTo, terrain, children }: Props) {
  const { t } = useI18n();
  const ref = useRef<MapRef | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // Only a map that never comes up counts as failed: single tiles drop out all the time on a weak network
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = window.setTimeout(() => setStatus((s) => (s === 'loading' ? 'failed' : s)), 15000);
    return () => window.clearTimeout(timer);
  }, [status]);

  // Camera flight on era change; the first era is handled by initialViewState
  useEffect(() => {
    if (status !== 'ready') return;
    const { center, zoom, pitch, bearing } = period.camera;
    ref.current?.getMap()?.flyTo({ center, zoom, pitch, bearing, duration: 2200, essential: true });
  }, [period, status]);

  useEffect(() => {
    if (status !== 'ready' || !flyTo) return;
    ref.current?.getMap()?.flyTo({ center: flyTo.center, zoom: flyTo.zoom, duration: 1400, essential: true });
  }, [flyTo, status]);

  const cam = period.camera;
  return (
    <div className="atlas-map absolute inset-0">
      <Map
        ref={ref}
        mapStyle={terrain ? TERRAIN_STYLE : FLAT_STYLE}
        pixelRatio={PIXEL_RATIO}
        initialViewState={{ longitude: cam.center[0], latitude: cam.center[1], zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing }}
        maxBounds={KZ_BOUNDS}
        minZoom={2.5}
        maxZoom={16}
        maxPitch={75}
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        onClick={(e) => {
          const hit = e.features?.[0];
          onFeatureClick?.(hit ? hit.layer.id : null, hit ? (hit.properties as Record<string, unknown>) : null);
        }}
        // images are part of the style: add them again whenever a style (3D relief on/off) loads
        onStyleData={(e) => addMapImages(e.target)}
        onLoad={(e) => {
          addMapImages(e.target);
          setStatus('ready');
          // compact attribution starts expanded and would sit over the era title; keep it as the (i) button
          ref.current
            ?.getContainer()
            .querySelectorAll('.maplibregl-compact-show')
            .forEach((el) => el.classList.remove('maplibregl-compact-show'));
        }}
        onError={(e) => console.warn('[map]', e.error?.message ?? e.error)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <NavigationControl position="top-right" showCompass visualizePitch />
        <AttributionControl position="top-left" compact />
        {children}
      </Map>

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/80">
          <p className="animate-pulse text-sm text-muted-foreground">{t('loadingMap')}</p>
        </div>
      )}
      {status === 'failed' && (
        <div className="absolute inset-0 grid place-items-center bg-background/90 px-6">
          <p className="max-w-sm text-center text-sm text-balance text-muted-foreground">{t('mapFailed')}</p>
        </div>
      )}
    </div>
  );
}
