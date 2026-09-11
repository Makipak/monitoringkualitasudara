// Push notification delivery via Firebase Cloud Messaging (architecture.md
// 6.3). Mirrors ml.js/threshold.js's single-responsibility, side-effect-
// isolated style: this module only knows how to talk to FCM, not when to
// call it (that's mqtt.js) or who to send to (services/db.js). Android
// only for now - the mobile app has not wired iOS (see CLAUDE.md mobile/
// section on Apple Developer Program being required for that) - but any
// registered token, regardless of platform, is sent to the same way.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { FIREBASE_SERVICE_ACCOUNT_BASE64 } from "../config.js";

let cachedMessaging = null;
let loggedMissingCredential = false;

// Lazily initializes the Firebase Admin app on first use rather than at
// import time, so a backend without FIREBASE_SERVICE_ACCOUNT_BASE64 set
// (push notifications not configured yet) never throws on startup - only
// sendAlertPush() short-circuits, same fail-safe shape as
// ml.js/buildWindowPayload() returning null.
function getMessagingClient() {
  if (cachedMessaging) return cachedMessaging;

  if (!FIREBASE_SERVICE_ACCOUNT_BASE64) {
    if (!loggedMissingCredential) {
      loggedMissingCredential = true;
      console.warn(
        "[push] FIREBASE_SERVICE_ACCOUNT_BASE64 not set - push notifications are disabled " +
          "(alerts still work over WebSocket/REST, see backend/README.md)",
      );
    }
    return null;
  }

  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      Buffer.from(FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"),
    );
    initializeApp({ credential: cert(serviceAccount) });
  }
  cachedMessaging = getMessaging();
  return cachedMessaging;
}

// Sends one notification to every token in `tokens` via FCM's multicast
// API. Returns which tokens FCM reports as permanently invalid (app
// uninstalled, token rotated) so the caller can drop them from
// device_push_tokens - without this, a stale token would fail on every
// future alert forever.
export async function sendAlertPush(tokens, { title, body }) {
  const messaging = getMessagingClient();
  if (!messaging || tokens.length === 0) return { sent: 0, invalidTokens: [] };

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: { priority: "high" },
  });

  const invalidTokens = [];
  response.responses.forEach((result, i) => {
    if (!result.success && isUnregistered(result.error)) {
      invalidTokens.push(tokens[i]);
    }
  });

  return { sent: response.successCount, invalidTokens };
}

function isUnregistered(error) {
  const code = error?.code ?? "";
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}
