import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Button } from './Button';
import { cn } from './cn';
import { LangSwitch } from './LangSwitch';

// Back button on the left, language switch on the right; floats over maps
export function TopBar({ onBack, children, className }: { onBack: () => void; children?: ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn('pointer-events-none flex items-start justify-between gap-3 p-3 sm:p-4', className)}>
      <Button variant="ghost" onClick={onBack} aria-label={t('home')} className="pointer-events-auto shrink-0 px-3">
        <span aria-hidden="true">←</span>
        {/* on narrow phones, and with the larger text, the arrow alone leaves room for the switches */}
        <span className="whitespace-nowrap max-[430px]:hidden">{t('home')}</span>
      </Button>
      {children}
      <LangSwitch className="pointer-events-auto" />
    </div>
  );
}
