import { MotionConfig } from 'framer-motion';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import App from './App';
import { I18nProvider } from './i18n';
import { useComfort } from './ui/comfort';
import { IntroDialog } from './ui/IntroDialog';

// "Less motion" in the comfort settings switches framer-motion animations off everywhere
function Motion({ children }: { children: ReactNode }) {
  const { calm } = useComfort();
  return <MotionConfig reducedMotion={calm ? 'always' : 'user'}>{children}</MotionConfig>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Motion>
        <App />
        <IntroDialog />
      </Motion>
    </I18nProvider>
  </StrictMode>,
);
