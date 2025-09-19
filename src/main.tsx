import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import '@/index.css';

declare global {
  interface WindowEventMap {
    'app:toggle-theme': CustomEvent<{ theme: 'light' | 'dark' }>;
  }
}

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element with id="root" was not found.');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
