# services

API/WebSocket logic, kept separate from UI (screens/, components/) and from
state (hooks/) - see architecture.md section 6.2 and rule.md section 7.

The mobile app never talks to MQTT or the ESP32 device directly - all
communication goes through the backend's REST API and WebSocket
(architecture.md: device/broker/backend/app layers only talk to their
direct neighbor).

- `api.ts` - REST calls to the backend (`/api/auth/token`, `/api/rooms/...`).
- `socket.ts` - WebSocket client for realtime sensor_reading broadcasts.
- `notifications.ts` - planned, not implemented yet (FCM push, see
  architecture.md section 6.3 and prd.md FR-A4).

Backend base URL and the placeholder shared access key live in
`../config/env.ts` (gitignored, copy from `env.example.ts`).
