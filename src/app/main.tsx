import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from '../pages/landing/LandingPage';
import '../shared/digitable/digitable.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
