// Entry point: wires the REST app, WebSocket server, and MQTT subscriber
// together (architecture.md 4.5).
import http from "node:http";
import { createApp } from "./app.js";
import { startMqttSubscriber } from "./services/mqtt.js";
import { initWebSocketServer } from "./services/ws.js";
import { markStaleDevicesOffline } from "./services/db.js";
import { installGoogleDnsPin } from "./services/googleDnsPin.js";
import { PORT, DEVICE_STATUS_SWEEP_INTERVAL_MS } from "./config.js";

// No-ops unless GOOGLE_API_DNS_PIN_IP is set (see config.js) - shared
// cPanel hosting's firewall workaround for reaching Google's APIs
// (Firebase push). Must run before anything makes a googleapis.com
// request (services/push.js).
installGoogleDnsPin();

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
