// src/store/settingsStore.js – global app settings (currency, rate)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSettingsStore = create(
  persist(
    (set, get) => ({
      currency:   'USD',       // 'USD' | 'SSP'
      usdToSsp:   1300,        // default South Sudan rate
      sspToUsd:   0.00077,

      setCurrency: (c)    => set({ currency: c }),
      setRate:     (rate) => set({ usdToSsp: rate, sspToUsd: 1 / rate }),

      fmt: (usd) => {
        const { currency, usdToSsp } = get();
        if (currency === 'SSP') {
          const ssp = usd * usdToSsp;
          return `SSP ${ssp.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        }
        return `$${Number(usd).toFixed(2)}`;
      }
    }),
    { name: 'af-settings' }
  )
);

export default useSettingsStore;
