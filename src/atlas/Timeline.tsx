import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { cn } from '../ui/cn';
import { PERIODS, formatRange } from './periods';

interface Props {
  index: number;
  onChange: (next: number) => void;
  demo: boolean;
  onToggleDemo: () => void;
}

const clamp = (n: number) => Math.min(PERIODS.length - 1, Math.max(0, n));

export default function Timeline({ index, onChange, demo, onToggleDemo }: Props) {
  const { t, lang } = useI18n();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  // Arrows drive the timeline from anywhere on the screen: it is the primary control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'ArrowLeft') onChange(clamp(index - 1));
      else if (e.key === 'ArrowRight') onChange(clamp(index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onChange]);

  // keep the active era in view on narrow screens, where the strip scrolls sideways
  useEffect(() => {
    const el = trackRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }, [index, reduced]);

  return (
    <div className="rounded-2xl border border-border/80 bg-card/92 p-2 shadow-2xl sm:p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{t('timeline')}</span>
        <button
          type="button"
          onClick={onToggleDemo}
          aria-pressed={demo}
          className={cn(
            'min-h-9 rounded-lg px-3 text-xs font-medium transition-colors',
            demo ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {demo ? `■ ${t('demoStop')}` : `▶ ${t('demo')}`}
        </button>
      </div>
      <div
        ref={trackRef}
        role="tablist"
        aria-label={t('timeline')}
        className="flex snap-x gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {PERIODS.map((p, i) => {
          const active = i === index;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(i)}
              style={active ? { color: p.color, borderColor: p.color } : undefined}
              className={cn(
                'relative min-h-12 min-w-[7.5rem] flex-1 snap-center rounded-lg border border-transparent px-2.5 py-1.5 text-left transition-colors lg:min-w-0',
                active ? 'bg-accent/70' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId={reduced ? undefined : 'timeline-bar'}
                  className="absolute inset-x-2.5 top-0 h-[3px] rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              )}
              <span className="block truncate text-[13px] leading-tight font-semibold">{p.name[lang]}</span>
              <span className="mt-0.5 block text-[11px] tabular-nums opacity-70">{formatRange(p, lang)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
