// src/hooks/useOnlineStatus.js
import { useState, useEffect } from 'react';
import { syncPendingSales, getPendingCount } from '../offline/syncManager';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export const useOnlineStatus = () => {
  const ownerUserId = useAuthStore(state => state.offlineUserId || state.user?._id || state.user?.id);
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]     = useState(false);

  useEffect(() => {
    const syncQueuedSales = async (notify = false) => {
      const count = await getPendingCount(ownerUserId);
      if (count > 0) {
        setIsSyncing(true);
        if (notify) toast.loading(`Syncing ${count} offline sale(s)…`, { id: 'sync' });
        const result = await syncPendingSales(ownerUserId);
        setIsSyncing(false);
        if (notify && result.synced > 0) toast.success(`${result.synced} sale(s) synced successfully!`, { id: 'sync' });
        if (notify && result.failed > 0) toast.error(`${result.failed} sale(s) require review.`, { id: 'sync' });
        setPendingCount(await getPendingCount(ownerUserId));
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

    getPendingCount(ownerUserId).then(setPendingCount);
    if (navigator.onLine) syncQueuedSales();

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [ownerUserId]);

  return { isOnline, pendingCount, isSyncing };
};
