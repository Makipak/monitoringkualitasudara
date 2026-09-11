# services

API/WebSocket logic, kept separate from UI (screens/, components/) and from
state (hooks/) - see architecture.md section 6.2 and rule.md section 7.

The mobile app never talks to MQTT or the ESP32 device directly - all
communication goes through the backend's REST API and WebSocket
(architecture.md: device/broker/backend/app layers only talk to their
direct neighbor).

- `api.ts` - REST calls to the backend (`/api/auth/token`, `/api/rooms/...`,
  `/api/push-tokens`).
- `socket.ts` - WebSocket client for realtime sensor_reading broadcasts.
- `notifications.ts` - FCM push notification setup (architecture.md
  section 6.3 and prd.md FR-A4), **Android only** for now - see
  `../../README.md` "Push notifications" for the `google-services.json`
  setup step this needs before the app will build.

Backend base URL and the placeholder shared access key live in
`../config/env.ts` (gitignored, copy from `env.example.ts`).
