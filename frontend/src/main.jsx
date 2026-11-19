// src/main.jsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App';
import './index.css';

// Retire runtime caches created by earlier builds. These caches could
// contain authenticated customer/dashboard API responses on shared devices.
const LEGACY_PRIVATE_API_CACHES = new Set([
  'products-cache',
  'customers-cache',
  'dashboard-cache'
]);

if (typeof window !== 'undefined' && 'caches' in window) {
  window.caches.keys()
    .then(names => Promise.all(names
      .filter(name => LEGACY_PRIVATE_API_CACHES.has(name))
      .map(name => window.caches.delete(name))))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
