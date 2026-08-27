// Entry point: wires the REST app, WebSocket server, and MQTT subscriber
// together (architecture.md 4.5).
import http from "node:http";
import { createApp } from "./app.js";
import { startMqttSubscriber } from "./services/mqtt.js";
import { initWebSocketServer } from "./services/ws.js";
import { markStaleDevicesOffline } from "./services/db.js";
import { PORT, DEVICE_STATUS_SWEEP_INTERVAL_MS } from "./config.js";

const app = createApp();
const server = http.createServer(app);

initWebSocketServer(server);
startMqttSubscriber();

setInterval(() => {
  markStaleDevicesOffline().catch((err) =>
    console.error("[devices] failed to sweep stale devices:", err.message),
  );
}, DEVICE_STATUS_SWEEP_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
