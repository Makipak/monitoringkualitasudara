// Realtime broadcast to the mobile app (architecture.md 4.4). v1 uses
// native `ws` rather than socket.io - per the trade-off recorded there,
// `ws` is enough for a single device and avoids socket.io's extra
// overhead; revisit if multi-room broadcast is needed later.
import { WebSocketServer } from "ws";

let wss = null;

export function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "connected" }));
  });
  return wss;
}

export function broadcastToClients(reading, alerts) {
  if (!wss) return;

  const message = JSON.stringify({ type: "sensor_reading", reading, alerts });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

// Composite-status prediction from the BiGRU classifier (services/ml.js),
// broadcast separately from sensor_reading since it's computed far less
// often (only once a full window of readings is available).
export function broadcastPrediction(prediction) {
  if (!wss) return;

  const message = JSON.stringify({ type: "prediction", prediction });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}
