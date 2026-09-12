// Registers/removes one app install's FCM token for push notifications
// (architecture.md 6.3, schema.md 3.7 device_push_tokens). Not nested
// under /api/rooms like rooms.js - a push token belongs to an app
// install, not to a specific monitored room.
import { Router } from "express";
import { upsertPushToken, deletePushToken, getAllPushTokens } from "../services/db.js";
import { sendAlertPush, sendAlertPushDebug } from "../services/push.js";

const router = Router();

const VALID_PLATFORMS = ["android", "ios"];

router.post("/", async (req, res, next) => {
  try {
    const { token, platform } = req.body ?? {};
    if (typeof token !== "string" || !token || !VALID_PLATFORMS.includes(platform)) {
      return res
        .status(400)
        .json({ error: '"token" (string) and "platform" ("android"|"ios") are required' });
    }
    await upsertPushToken(token, platform);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Called when the app disables notifications or signs the token out -
// without this, a deliberately-cleared token would sit in the table until
// FCM happens to reject it on some future send.
router.delete("/", async (req, res, next) => {
  try {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: '"token" (string) is required' });
    }
    await deletePushToken(token);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// TEMPORARY manual-test route, added 2026-09-12 to verify
// FIREBASE_SERVICE_ACCOUNT_BASE64 works from inside the actual deployed
// process (Passenger-managed) rather than a manually-run shell script -
// the shared cPanel hosting's Terminal/SSH shell has a separate,
// stricter resource limit that crashes plain `node script.js` runs
// unrelated to whether the deployed app itself works (see deploy/
// cpanel-README.md and this session's notes). Remove this route once
// push notifications are confirmed working end-to-end - it is not part
// of the product's actual feature set (rule.md: single responsibility).
router.post("/test-send", async (req, res, next) => {
  try {
    const tokens = await getAllPushTokens();
    const result = await sendAlertPushDebug(tokens, {
      title: "Tes Notifikasi Falhora",
      body: "Kalau ini muncul, FCM sudah terkonfigurasi dengan benar.",
    });
    res.json({ tokenCount: tokens.length, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
