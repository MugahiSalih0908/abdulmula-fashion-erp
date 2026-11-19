// src/main.jsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App';
import './index.css';

// Remove private API caches created by older service-worker versions.
// These caches were URL-keyed and could survive a staff account switch on shared shop devices.
if ('caches' in window) {
  Promise.all([
    'products-cache',
    'customers-cache',
    'dashboard-cache'
  ].map(cacheName => window.caches.delete(cacheName))).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
