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
      <Button variant="ghost" onClick={onBack} className="pointer-events-auto px-3">
        <span aria-hidden="true">←</span>
        {t('home')}
      </Button>
      {children}
      <LangSwitch className="pointer-events-auto" />
    </div>
  );
}
