// WebSocket client for realtime updates (architecture.md section 4.4).
// Backend broadcasts a `sensor_reading` message to every connected client
// whenever a new reading is stored - see backend/src/services/ws.js.
//
// Reconnects automatically (capped exponential backoff) whenever the
// socket closes or errors, and also proactively when the app returns to
// the foreground - RN's WebSocket commonly dies silently while
// backgrounded without ever firing onclose. Without this, the Dashboard
// would go stale until the user force-reloads (see hooks/useSensorData.ts,
// which uses the status callback below to backfill via REST after a
// reconnect).
//
// Note: this endpoint is not gated behind JWT auth on the backend yet
// (see backend/README.md "Known placeholders") - nothing extra to send
// here for now.
import { AppState } from 'react-native';

import { API_BASE_URL } from '../config/env';
import type { Alert, Prediction, SensorReading } from './api';

type SocketMessage =
  | { type: 'connected' }
  | { type: 'sensor_reading'; reading: SensorReading; alerts: Alert[] }
  | { type: 'prediction'; prediction: Prediction };

type Listener = (message: SocketMessage) => void;
export type SocketStatus = 'open' | 'closed';
type StatusListener = (status: SocketStatus) => void;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

export function connectSocket(onMessage: Listener, onStatusChange?: StatusListener): () => void {
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let stopped = false;

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    onStatusChange?.('closed');
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  };

  function open() {
    if (stopped) return;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      attempt = 0;
      onStatusChange?.('open');
    };

    socket.onmessage = event => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // Ignore malformed frames rather than crash the screen.
      }
    };

    socket.onclose = scheduleReconnect;
    socket.onerror = scheduleReconnect;
  }

  open();

  // Android/iOS commonly kill a backgrounded socket outright instead of
  // firing onclose - check and reconnect as soon as the app is active
  // again rather than waiting on backoff.
  const appStateSub = AppState.addEventListener('change', nextState => {
    if (nextState !== 'active' || stopped) return;
    if (socket?.readyState === WebSocket.OPEN) return;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    attempt = 0;
    open();
  });

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    appStateSub.remove();
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
    socket = null;
  };
}
