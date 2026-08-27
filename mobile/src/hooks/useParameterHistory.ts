// Fetches GET /api/rooms/:deviceId/history for one parameter over a
// chosen lookback window, for the ParameterDetailScreen chart/stats.
// Separate from useSensorData (dashboard "current status") - a different
// concern, per rule.md section 7.
import { useCallback, useEffect, useState } from 'react';

import { getHistory, type SensorReading } from '../services/api';
import type { ParameterKey } from '../constants/parameters';

const RANGE_HOURS: Record<string, number> = {
  '1 Jam': 1,
  '6 Jam': 6,
  '12 Jam': 12,
  '24 Jam': 24,
  '7 Hari': 24 * 7,
};

export function useParameterHistory(deviceId: string, parameter: ParameterKey, range: string) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hours = RANGE_HOURS[range] ?? 6;
      const to = new Date();
      const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
      const rows = await getHistory(deviceId, from.toISOString(), to.toISOString());
      setReadings(rows);
    } catch {
      setReadings([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const values = readings
    .map(r => r[parameter])
    .filter((v): v is number => v !== null && v !== undefined);

  return { readings, values, loading, refresh: load };
}
