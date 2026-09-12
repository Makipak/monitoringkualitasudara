// REST client for the backend (architecture.md section 4.3, backend/README.md).
// Kept separate from screens/hooks (rule.md section 7: API calls separated
// from UI components).
import { API_BASE_URL, APP_ACCESS_KEY } from '../config/env';

export type SensorReading = {
  time: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  co2: number | null;
  tvoc: number | null;
  lux: number | null;
  noise_db: number | null;
  temperature: number | null;
  humidity: number | null;
};

export type ParameterStatus = 'normal' | 'not_normal';

export type Alert = {
  parameter: string;
  value: number;
  direction: 'high' | 'low';
  recommendation: string;
};

// ISPU-style composite score (backend/src/services/iaqIndex.js) -
// 0/50/100/200/300+ scale, higher is worse (Baik/Sedang/Tidak
// Sehat/Sangat Tidak Sehat/Berbahaya), NOT a 0-100 "higher is better"
// percentage. null only if the reading has no evaluable parameters at
// all (shouldn't happen once a device is reporting anything).
export type IaqIndex = {
  value: number;
  category: 'Baik' | 'Sedang' | 'Tidak Sehat' | 'Sangat Tidak Sehat' | 'Berbahaya';
  breakdown: Array<{ parameter: string; value: number; subIndex: number; category: string }>;
};

export type RoomStatus = {
  time: string;
  status: Record<string, ParameterStatus>;
  alerts: Alert[];
  iaqIndex: IaqIndex | null;
  // Real device connectivity (schema.md devices.status/last_seen_at) -
  // NOT the same as "is my WebSocket connected to the backend"
  // (useSensorData.ts's `connection` state). A device that has been
  // offline for days can still have a stale `reading`/`status` above from
  // its last session - use this to tell the two apart.
  device: { online: boolean; lastSeenAt: string | null };
};

// One row from the `alerts` table (schema.md 3.5) - rule-based
// per-parameter out-of-range events, listed here for the Notifikasi
// screen's history. These no longer send a push notification themselves
// (that's now driven by the composite AI label entering Peringatan/Bahaya,
// see backend/src/services/mqtt.js sendPredictionAlertNotification) - this
// list is browsable history, not a feed of what pushed. `resolvedAt: null`
// means still out of range as of the last reading.
export type NotificationItem = {
  id: string;
  parameter: string;
  value: number;
  direction: 'high' | 'low' | null;
  recommendation: string;
  triggeredAt: string;
  resolvedAt: string | null;
};

export type PredictionLabel = 'Baik' | 'Rawan' | 'Peringatan' | 'Bahaya';

// From the BiGRU composite-status classifier (ml-service/), via
// GET /api/rooms/:deviceId/prediction. `available: false` is a routine
// state - not an error - until a full window of complete sensor readings
// exists (see backend/src/services/ml.js).
export type Prediction =
  | { available: false }
  | {
      available: true;
      time: string;
      label: PredictionLabel;
      class_index: number;
      probabilities: Record<PredictionLabel, number>;
      model_version: string;
    };

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

// In-memory only - re-fetched on app start. Good enough for the
// placeholder shared-key auth (see backend/README.md "Known
// placeholders"); revisit once real per-user login exists.
let cachedToken: string | null = null;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? `request failed with status ${response.status}`, response.status);
  }
  // POST/DELETE /api/push-tokens reply 204 No Content - .json() would throw
  // on an empty body.
  if (response.status === 204) return undefined as T;
  return response.json();
}

// No auth required - see backend/src/app.js. Use this to confirm the
// phone can reach the backend at all before dealing with tokens/data.
export async function checkHealth(): Promise<boolean> {
  try {
    const body = await request<{ status: string }>('/health');
    return body.status === 'ok';
  } catch {
    return false;
  }
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const body = await request<{ token: string }>('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessKey: APP_ACCESS_KEY }),
  });
  cachedToken = body.token;
  return cachedToken;
}

async function authedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const withAuth = (token: string): RequestInit => ({
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });

  const token = await getToken();
  try {
    return await request<T>(path, withAuth(token));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Token expired/invalid - drop it and retry once with a fresh one.
      cachedToken = null;
      const freshToken = await getToken();
      return request<T>(path, withAuth(freshToken));
    }
    throw err;
  }
}

export function getLatestReading(deviceId: string): Promise<SensorReading> {
  return authedRequest(`/api/rooms/${deviceId}/latest`);
}

export function getRoomStatus(deviceId: string): Promise<RoomStatus> {
  return authedRequest(`/api/rooms/${deviceId}/status`);
}

export function getHistory(
  deviceId: string,
  from: string,
  to: string,
): Promise<SensorReading[]> {
  const query = new URLSearchParams({ from, to }).toString();
  return authedRequest(`/api/rooms/${deviceId}/history?${query}`);
}

export function getPrediction(deviceId: string): Promise<Prediction> {
  return authedRequest(`/api/rooms/${deviceId}/prediction`);
}

export function getNotifications(deviceId: string, limit = 50): Promise<NotificationItem[]> {
  return authedRequest(`/api/rooms/${deviceId}/notifications?limit=${limit}`);
}

export type PushPlatform = 'android' | 'ios';

// Registers/refreshes this app install's FCM token with the backend
// (backend/src/routes/pushTokens.js, schema.md 3.7 device_push_tokens).
// See mobile/src/services/notifications.ts.
export function registerPushToken(token: string, platform: PushPlatform): Promise<void> {
  return authedRequest('/api/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  });
}

export function unregisterPushToken(token: string): Promise<void> {
  return authedRequest('/api/push-tokens', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

// GET .../export?date=&format= (backend/README.md) - resolved format
// question from prd.md section 9. Only 'xlsx'/'pdf' request an actual
// file; the endpoint's `format`-less JSON-aggregate response has no app
// use yet, so it's not modeled here.
export type ExportFormat = 'xlsx' | 'pdf';

// Returns the absolute download URL rather than fetching it here - the
// actual download has to go through react-native-blob-util (native file
// I/O, hooks/useExport.ts), which does its own networking and bypasses
// this file's request()/authedRequest() wrappers.
export function getExportUrl(deviceId: string, date: string, format: ExportFormat): string {
  const query = new URLSearchParams({ date, format }).toString();
  return `${API_BASE_URL}/api/rooms/${deviceId}/export?${query}`;
}

// Exposes the same bearer token authedRequest() uses internally, for
// hooks/useExport.ts to attach to its own native fetch call.
export function getAuthToken(): Promise<string> {
  return getToken();
}

export { ApiError };
