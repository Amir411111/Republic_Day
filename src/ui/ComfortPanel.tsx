import { ALargeSmall, CircleHelp, Contrast, Waves, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { cn } from './cn';
import { setComfort, useComfort, type Comfort } from './comfort';
import { Dialog } from './Dialog';
import { openIntro } from './intro';

const OPTIONS: { key: keyof Comfort; icon: LucideIcon; title: StringKey; text: StringKey }[] = [
  { key: 'bigText', icon: ALargeSmall, title: 'comfortBigText', text: 'comfortBigTextHint' },
  { key: 'contrast', icon: Contrast, title: 'comfortContrast', text: 'comfortContrastHint' },
  { key: 'calm', icon: Waves, title: 'comfortCalm', text: 'comfortCalmHint' },
];

// "Aa" button next to the language switch; opens the comfortable view settings
export function ComfortButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('comfortTitle')}
        title={t('comfortTitle')}
        className="grid min-h-12 min-w-12 place-items-center rounded-xl border border-border/80 bg-card/90 px-3 font-display text-lg font-bold text-foreground hover:bg-accent"
      >
        Aa
      </button>
      {open && <ComfortPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function ComfortPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const comfort = useComfort();
  return (
    <Dialog title={t('comfortTitle')} onClose={onClose}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t('comfortLead')}</p>
      <ul className="divide-y divide-border">
        {OPTIONS.map(({ key, icon: Icon, title, text }) => (
          <li key={key}>
            <button
              type="button"
              role="switch"
              aria-checked={comfort[key]}
              onClick={() => setComfort({ [key]: !comfort[key] })}
              className="flex min-h-16 w-full items-center gap-4 py-3 text-left"
            >
              <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(title)}</span>
                <span className="block text-sm text-muted-foreground">{t(text)}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative h-7 w-12 shrink-0 rounded-full border transition-colors',
                  comfort[key] ? 'border-primary bg-primary' : 'border-border bg-card',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-5 rounded-full transition-all',
                    comfort[key] ? 'left-6 bg-primary-foreground' : 'left-0.5 bg-muted-foreground',
                  )}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          onClose();
          openIntro();
        }}
        className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/80 px-4 text-left font-semibold hover:bg-accent"
      >
        <CircleHelp aria-hidden="true" className="size-5 text-primary" />
        {t('introAgain')}
      </button>
    </Dialog>
  );
}
