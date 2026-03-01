import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './lib/LanguageContext';

const FIREBASE_CONFIG_KEY = 'firebase_config';

async function preloadFirebaseConfig() {
  // If we already have a config in localStorage, nothing to do.
  if (localStorage.getItem(FIREBASE_CONFIG_KEY)) return;
  try {
    const res = await fetch('/api/firebase-config');
    if (res.ok) {
      const config = await res.json();
      if (config && config.apiKey && config.projectId) {
        localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
      }
    }
  } catch {
    // Server not reachable in pure-dev mode (Vite only) — fall through gracefully.
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

preloadFirebaseConfig().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </StrictMode>,
  );
});
