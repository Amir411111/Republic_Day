import { LANGS, useI18n } from '../i18n';
import type { Lang } from '../game/types';
import { cn } from './cn';
import { ComfortButton } from './ComfortPanel';

const LABEL: Record<Lang, string> = { kk: 'ҚАЗ', ru: 'РУС', en: 'ENG' };

// The three language buttons; also used inside the site tour, which covers the page
export function LangButtons({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      role="group"
      aria-label="Тіл / Язык / Language"
      className={cn('flex items-center gap-0.5 rounded-xl border border-border/80 bg-card/90 p-1', className)}
    >
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={code === lang}
          className={cn(
            'min-h-10 rounded-lg px-2.5 text-xs font-semibold tracking-wide transition-colors',
            code === lang
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {LABEL[code]}
        </button>
      ))}
    </div>
  );
}

// The language switch, with the comfortable view button beside it on every screen
export function LangSwitch({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <ComfortButton />
      <LangButtons />
    </div>
  );
}
