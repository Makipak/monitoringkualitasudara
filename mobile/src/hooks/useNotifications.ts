// Fetches GET /api/rooms/:deviceId/notifications (alert history) for the
// Notifikasi screen. REST-on-mount + manual refresh, same shape as
// useParameterHistory.ts - this list is browsed, not live-critical enough
// to warrant its own WebSocket subscription (the Dashboard's live alert
// banner already covers "right now").
import { useCallback, useEffect, useState } from 'react';

import { getNotifications, type NotificationItem } from '../services/api';

export function useNotifications(deviceId: string) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getNotifications(deviceId);
      setNotifications(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { notifications, loading, error, refresh: load };
}
