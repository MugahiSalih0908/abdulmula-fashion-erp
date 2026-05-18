// src/hooks/useOnlineStatus.js
import { useState, useEffect } from 'react';
import { syncPendingSales, getPendingCount } from '../offline/syncManager';
import toast from 'react-hot-toast';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]     = useState(false);

  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      const count = await getPendingCount();
      if (count > 0) {
        setIsSyncing(true);
        toast.loading(`Syncing ${count} offline sale(s)…`, { id: 'sync' });
        const result = await syncPendingSales();
        setIsSyncing(false);
        if (result.synced > 0) toast.success(`${result.synced} sale(s) synced successfully!`, { id: 'sync' });
        if (result.failed > 0) toast.error(`${result.failed} sale(s) failed to sync.`, { id: 'sync' });
        setPendingCount(await getPendingCount());
      } else {
        toast.success('Back online!', { id: 'sync', duration: 2000 });
      }
    };

    const goOffline = () => {
      setIsOnline(false);
      toast('You are offline. Sales will be saved locally.', { icon: '📴', id: 'offline', duration: 4000 });
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    // Check pending count on mount
    getPendingCount().then(setPendingCount);

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline, pendingCount, isSyncing };
};
