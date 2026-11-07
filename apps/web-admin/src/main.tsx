import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BASE_PATH } from './config';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Rend le portail installable (plein écran, sans barre d'adresse). Silencieux si le navigateur ne le permet pas.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(() => undefined);
  });
}
