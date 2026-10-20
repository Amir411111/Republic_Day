import { useI18n } from '../i18n';
import { TopBar } from '../ui/TopBar';
import Guide from './Guide';

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col bg-background bg-[radial-gradient(ellipse_at_top,rgba(216,175,79,0.10)_0%,transparent_60%)]">
      <TopBar onBack={onBack} />
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('guideTitle')}</h1>
        <p className="mt-2 mb-5 text-sm text-pretty text-muted-foreground sm:text-base">{t('guideLead')}</p>
        <Guide />
      </div>
    </div>
  );
}
