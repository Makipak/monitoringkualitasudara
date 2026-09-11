// Express app wiring, kept separate from server.listen()/MQTT/WS startup
// in index.js so the app itself stays easy to reason about and test.
import express from "express";
import authRoutes from "./routes/auth.js";
import roomsRoutes from "./routes/rooms.js";
import pushTokensRoutes from "./routes/pushTokens.js";
import { requireAuth } from "./middleware/auth.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  // Unauthenticated - lets the mobile app (or a browser on the same
  // network) confirm it can reach the backend at all before dealing with
  // tokens/MQTT/DB.
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/rooms", requireAuth, roomsRoutes);
  app.use("/api/push-tokens", requireAuth, pushTokensRoutes);

  // Central error handler - keeps route handlers from formatting their own
  // error responses (rule.md section 3: single responsibility). Express
  // only treats this as an error handler because it takes 4 arguments.
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
