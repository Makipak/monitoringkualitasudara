// Placeholder auth (see middleware/auth.js) - trades a shared access key
// for a JWT the mobile app then attaches to every REST/WebSocket request.
// Replace with real per-user login once role/permission design lands
// (prd.md section 9).
import { Router } from "express";
import jwt from "jsonwebtoken";
import { APP_ACCESS_KEY, JWT_SECRET, JWT_EXPIRES_IN } from "../config.js";

const router = Router();

router.post("/token", (req, res) => {
  const { accessKey } = req.body ?? {};
  if (accessKey !== APP_ACCESS_KEY) {
    return res.status(401).json({ error: "invalid accessKey" });
  }

  const token = jwt.sign({ sub: "udara-app" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, expiresIn: JWT_EXPIRES_IN });
});

export default router;
