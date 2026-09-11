// Registers/removes one app install's FCM token for push notifications
// (architecture.md 6.3, schema.md 3.7 device_push_tokens). Not nested
// under /api/rooms like rooms.js - a push token belongs to an app
// install, not to a specific monitored room.
import { Router } from "express";
import { upsertPushToken, deletePushToken } from "../services/db.js";

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

export default router;
