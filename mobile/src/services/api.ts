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

export type RoomStatus = {
  time: string;
  status: Record<string, ParameterStatus>;
  alerts: Alert[];
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

async function authedRequest<T>(path: string): Promise<T> {
  const token = await getToken();
  try {
    return await request<T>(path, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Token expired/invalid - drop it and retry once with a fresh one.
      cachedToken = null;
      const freshToken = await getToken();
      return request<T>(path, { headers: { Authorization: `Bearer ${freshToken}` } });
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

export { ApiError };
