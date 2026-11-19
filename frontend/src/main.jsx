// src/main.jsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App';
import './index.css';

// Retire runtime caches created by earlier builds before mounting the app.
// This prevents an old service worker cache from serving authenticated customer
// or dashboard API responses during the first render after upgrade.
const bootstrap = async () => {
  const legacyPrivateApiCaches = new Set([
    'products-cache',
    'customers-cache',
    'dashboard-cache'
  ]);

  try {
    if ('caches' in window) {
      const names = await window.caches.keys();
      await Promise.all(names
        .filter(name => legacyPrivateApiCaches.has(name))
        .map(name => window.caches.delete(name)));
    }
  } catch {
    // The ERP still opens when Cache Storage is unavailable or blocked.
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

bootstrap();
