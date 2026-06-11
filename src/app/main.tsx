import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from '../pages/landing/LandingPage';
import { WithTranslate } from '../shared/i18n';
import '../shared/digitable/digitable.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <WithTranslate>
      <LandingPage />
    </WithTranslate>
  </StrictMode>,
);
