// src/hooks/useOnlineStatus.js
import { useState, useEffect } from 'react';
import { syncPendingSales, getPendingCount } from '../offline/syncManager';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export const useOnlineStatus = () => {
  const userId = useAuthStore(state => state.user?._id);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    let syncInProgress = false;

    const refreshCount = async () => {
      if (!userId) {
        if (active) setPendingCount(0);
        return 0;
      }
      const count = await getPendingCount(userId);
      if (active) setPendingCount(count);
      return count;
    };

    const syncQueuedSales = async (notify = false) => {
      if (!userId || syncInProgress) return;
      syncInProgress = true;
      try {
        const count = await refreshCount();
        if (count > 0) {
          if (active) setIsSyncing(true);
          if (notify) toast.loading(`Syncing ${count} offline sale(s)…`, { id: 'sync' });
          const result = await syncPendingSales(userId);
          if (!active) return;
          if (notify && result.synced > 0) toast.success(`${result.synced} sale(s) synced successfully!`, { id: 'sync' });
          if (notify && result.failed > 0) toast.error(`${result.failed} sale(s) require review.`, { id: 'sync' });
          await refreshCount();
        } else if (notify) {
          toast.success('Back online!', { id: 'sync', duration: 2000 });
        }
      } catch (error) {
        if (active && notify) toast.error(error?.message || 'Offline sales could not be synchronized.', { id: 'sync' });
      } finally {
        syncInProgress = false;
        if (active) setIsSyncing(false);
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

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    refreshCount().catch(() => {});
    if (navigator.onLine) syncQueuedSales();

    return () => {
      active = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [userId]);

  return { isOnline, pendingCount, isSyncing };
};
