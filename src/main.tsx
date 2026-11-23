import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './client-theme.css';
import './protectedUSERS_root_path_secure/protected-users.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Service worker registration failed.', error);
    });
  });
}
