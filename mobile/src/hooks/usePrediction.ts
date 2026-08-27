// Fetches + subscribes to the composite-status prediction for one device
// (ml-service's BiGRU classifier via backend/src/services/ml.js), kept
// separate from the screen components (rule.md section 7). Mirrors
// useSensorData.ts's REST-on-mount + WebSocket-for-updates pattern.
import { useCallback, useEffect, useState } from 'react';

import { getPrediction, type Prediction } from '../services/api';
import { connectSocket } from '../services/socket';

type State = {
  prediction: Prediction | null;
  loading: boolean;
  error: string | null;
};

export function usePrediction(deviceId: string) {
  const [state, setState] = useState<State>({ prediction: null, loading: true, error: null });

  const load = useCallback(async () => {
    try {
      const prediction = await getPrediction(deviceId);
      setState({ prediction, loading: false, error: null });
    } catch (err) {
      setState({
        prediction: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Gagal memuat prediksi',
      });
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Opens its own WebSocket connection, separate from useSensorData's -
    // simplest option given socket.ts has no shared-connection manager
    // yet. A screen using both hooks ends up with two open sockets to the
    // same backend; acceptable at v1's single-device scale, revisit
    // socket.ts if that ever becomes a real cost.
    return connectSocket(message => {
      if (message.type === 'prediction') {
        setState({ prediction: message.prediction, loading: false, error: null });
      }
    });
  }, []);

  return { ...state, refresh: load };
}
