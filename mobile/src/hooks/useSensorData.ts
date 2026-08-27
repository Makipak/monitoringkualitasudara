// Fetches + subscribes to sensor data for one device, kept separate from
// the screen component (rule.md section 7: state/API calls separated
// from UI). Backend-mediated only - never talks to MQTT/the device
// directly (architecture.md: mobile <-> backend via REST/WebSocket).
import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  checkHealth,
  getLatestReading,
  getRoomStatus,
  type Alert,
  type RoomStatus,
  type SensorReading,
} from '../services/api';
import { connectSocket } from '../services/socket';

export type ConnectionState = 'checking' | 'online' | 'offline';

type State = {
  connection: ConnectionState;
  reading: SensorReading | null;
  status: RoomStatus | null;
  alerts: Alert[];
  error: string | null;
};

export function useSensorData(deviceId: string) {
  const [state, setState] = useState<State>({
    connection: 'checking',
    reading: null,
    status: null,
    alerts: [],
    error: null,
  });

  const load = useCallback(async () => {
    const healthy = await checkHealth();
    if (!healthy) {
      setState(prev => ({ ...prev, connection: 'offline', error: 'Backend tidak terjangkau' }));
      return;
    }

    try {
      const [reading, status] = await Promise.all([
        getLatestReading(deviceId),
        getRoomStatus(deviceId),
      ]);
      setState({
        connection: 'online',
        reading,
        status,
        alerts: status.alerts,
        error: null,
      });
    } catch (err) {
      // A healthy backend with no readings yet (device hasn't published,
      // or HiveMQ Access Management hasn't been fixed - see
      // backend/README.md) returns 404 here. Distinguish that from an
      // actual failure so the screen can show "waiting for data" instead
      // of "connection error".
      const message =
        err instanceof ApiError && err.status === 404
          ? 'Belum ada data sensor untuk device ini'
          : err instanceof Error
            ? err.message
            : 'Gagal memuat data';
      setState(prev => ({ ...prev, connection: 'online', error: message }));
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Tracks whether the socket has dropped since this effect started, so
    // a reconnect can trigger a one-off REST refresh to backfill whatever
    // arrived during the gap (the socket itself has no history replay).
    let missedWhileClosed = false;

    const disconnect = connectSocket(
      message => {
        if (message.type === 'sensor_reading') {
          setState(prev => ({
            ...prev,
            reading: message.reading,
            alerts: message.alerts,
            error: null,
          }));
        }
      },
      status => {
        if (status === 'closed') {
          missedWhileClosed = true;
        } else if (status === 'open' && missedWhileClosed) {
          missedWhileClosed = false;
          load();
        }
      },
    );
    return disconnect;
  }, [load]);

  return { ...state, refresh: load };
}
