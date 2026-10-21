import { ALargeSmall, Footprints, Gamepad2, Image, Map as MapIcon, Sparkles, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import monumentsMeta from '../../content/monuments-meta.json';
import { EVENTS } from '../atlas/events';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { Button } from './Button';
import { cn } from './cn';
import { Dialog } from './Dialog';
import { closeIntro, useIntroOpen } from './intro';

// A tour of the whole site, shown on the first visit and again from the comfort panel
const STEPS: { icon: LucideIcon; title: StringKey; text: StringKey }[] = [
  { icon: Sparkles, title: 'tour1Title', text: 'tour1Text' },
  { icon: Image, title: 'tour2Title', text: 'tour2Text' },
  { icon: Gamepad2, title: 'tour3Title', text: 'tour3Text' },
  { icon: MapIcon, title: 'tour4Title', text: 'tour4Text' },
  { icon: Footprints, title: 'tour5Title', text: 'tour5Text' },
  { icon: ALargeSmall, title: 'tour6Title', text: 'tour6Text' },
];

export function IntroDialog() {
  const open = useIntroOpen();
  return open ? <Intro /> : null;
}

function Intro() {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <Dialog title={t('introTitle')} onClose={closeIntro} className="sm:max-w-lg">
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
    </Dialog>
  );
}
