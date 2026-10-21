import { ALargeSmall, Footprints, Gamepad2, Image, Map as MapIcon, Sparkles, X, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import monumentsMeta from '../../content/monuments-meta.json';
import { EVENTS } from '../atlas/events';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { Button } from './Button';
import { cn } from './cn';
import { useComfort } from './comfort';
import { closeIntro, useIntroOpen } from './intro';
import { LangButtons } from './LangSwitch';

// A tour of the whole site, shown on the first visit and again from the comfort panel.
// Each step scrolls the landing page to its part (elements marked data-tour="…") and lights it
// up while the rest of the page is dimmed. Away from the landing page the steps are just cards.
const STEPS: { icon: LucideIcon; title: StringKey; text: StringKey; targets: string[] }[] = [
  { icon: Sparkles, title: 'tour1Title', text: 'tour1Text', targets: [] },
  { icon: Image, title: 'tour2Title', text: 'tour2Text', targets: ['how'] },
  { icon: Gamepad2, title: 'tour3Title', text: 'tour3Text', targets: ['modes'] },
  { icon: MapIcon, title: 'tour4Title', text: 'tour4Text', targets: ['atlas'] },
  { icon: Footprints, title: 'tour5Title', text: 'tour5Text', targets: ['guide', 'quest'] },
  { icon: ALargeSmall, title: 'tour6Title', text: 'tour6Text', targets: ['comfort'] },
];

const PAD = 8;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

// The box around all targets of a step, in viewport coordinates and kept inside the screen
function measure(targets: string[]): Box | null {
  const rects = targets
    .map((id) => document.querySelector(`[data-tour="${id}"]`)?.getBoundingClientRect())
    .filter((r): r is DOMRect => !!r && r.width > 0);
  if (rects.length === 0) return null;
  const top = Math.max(4, Math.min(...rects.map((r) => r.top)) - PAD);
  const left = Math.max(4, Math.min(...rects.map((r) => r.left)) - PAD);
  const bottom = Math.min(window.innerHeight - 4, Math.max(...rects.map((r) => r.bottom)) + PAD);
  const right = Math.min(window.innerWidth - 4, Math.max(...rects.map((r) => r.right)) + PAD);
  return { top, left, width: right - left, height: bottom - top };
}

export function IntroDialog() {
  const open = useIntroOpen();
  return open ? <Tour /> : null;
}

function Tour() {
  const { t } = useI18n();
  const { calm } = useComfort();
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  useEffect(() => {
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeIntro();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bring the step's part of the page into view, then follow it while the page scrolls there
  useLayoutEffect(() => {
    const first = step.targets.length ? document.querySelector(`[data-tour="${step.targets[0]}"]`) : null;
    if (first instanceof HTMLElement) {
      const r = first.getBoundingClientRect();
      // to the top of the screen, below the landing's top bar: the card then takes the lower half
      if (r.top < 0 || r.bottom > window.innerHeight * 0.55) {
        first.style.scrollMarginTop = '88px';
        first.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
      }
    }
    const update = () => setBox(measure(step.targets));
    update();
    let frame = 0;
    const until = performance.now() + 1200;
    const follow = () => {
      update();
      if (performance.now() < until) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [step, calm]);

  // the card goes to the half of the screen the highlighted part leaves free; a part taller than
  // the screen is scrolled to its top, so the card goes below its beginning
  const cardAtTop =
    !!box && box.height < window.innerHeight * 0.6 && box.top + box.height / 2 > window.innerHeight / 2;

  return (
    <div className="fixed inset-0 z-[100]">
      {box ? (
        <>
          {/* catches clicks so the page under the tour stays still */}
          <div className="absolute inset-0" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-2xl ring-2 ring-primary transition-all duration-300"
            style={{ ...box, boxShadow: '0 0 0 200vmax rgba(7, 13, 24, 0.78)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-background/80" />
      )}

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-3 mx-auto max-h-[calc(100svh-1.5rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-popover p-5 shadow-2xl outline-none sm:p-6',
          !box ? 'top-1/2 -translate-y-1/2' : cardAtTop ? 'top-3' : 'bottom-3',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl leading-tight font-bold sm:text-2xl">
            {t('introTitle')}
          </h2>
          <div className="flex items-center gap-1">
            <LangButtons />
            <button
              type="button"
              onClick={closeIntro}
              aria-label={t('close')}
              className="grid size-12 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
            <Icon aria-hidden="true" className="size-7" />
          </span>
          <div className="min-w-0" aria-live="polite">
            <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
              {t('introStep', { n: i + 1, total: STEPS.length })}
            </p>
            <h3 className="mt-1 text-lg font-semibold">{t(step.title)}</h3>
            <p className="mt-1 text-pretty text-muted-foreground">
              {t(step.text, { events: EVENTS.length, monuments: monumentsMeta.listed })}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
          {STEPS.map((s, k) => (
            <span
              key={s.title}
              className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-primary' : 'w-1.5 bg-border')}
            />
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          {i > 0 && (
            <Button variant="outline" onClick={() => setI(i - 1)} aria-label={t('introBack')}>
              ←
            </Button>
          )}
          <Button className="flex-1" onClick={() => (last ? closeIntro() : setI(i + 1))}>
            {last ? t('introStart') : t('introNext')}
          </Button>
        </div>
        {!last && (
          <button
            type="button"
            onClick={closeIntro}
            className="mx-auto mt-3 block min-h-12 px-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t('introSkip')}
          </button>
        )}
      </div>
    </div>
  );
}
