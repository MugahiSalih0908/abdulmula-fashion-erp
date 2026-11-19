// src/main.jsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App';
import './index.css';

// Remove runtime API caches created by older PWA releases. Offline POS data
// remains in the app's explicit IndexedDB stores and sync queue.
if ('caches' in window) {
  Promise.all(
    ['products-cache', 'customers-cache', 'dashboard-cache'].map(cacheName =>
      window.caches.delete(cacheName)
    )
  ).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
