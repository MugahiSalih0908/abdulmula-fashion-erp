// src/hooks/useOnlineStatus.js
import { useState, useEffect } from 'react';
import { syncPendingSales, getPendingCount } from '../offline/syncManager';
import toast from 'react-hot-toast';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]     = useState(false);

  useEffect(() => {
    const syncQueuedSales = async (notify = false) => {
      const count = await getPendingCount();
      if (count > 0) {
        setIsSyncing(true);
        if (notify) toast.loading(`Syncing ${count} offline sale(s)…`, { id: 'sync' });
        const result = await syncPendingSales();
        setIsSyncing(false);
        if (notify && result.synced > 0) toast.success(`${result.synced} sale(s) synced successfully!`, { id: 'sync' });
        if (notify && result.failed > 0) toast.error(`${result.failed} sale(s) require review.`, { id: 'sync' });
        setPendingCount(await getPendingCount());
      } else if (notify) {
        toast.success('Back online!', { id: 'sync', duration: 2000 });
      }
    };

    const goOnline = () => {
      setIsOnline(true);
      syncQueuedSales(true);
    };

    const goOffline = () => {
      setIsOnline(false);
      toast('You are offline. Sales will be saved locally.', { icon: '📴', id: 'offline', duration: 4000 });
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    getPendingCount().then(setPendingCount);
    if (navigator.onLine) syncQueuedSales();

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline, pendingCount, isSyncing };
};
