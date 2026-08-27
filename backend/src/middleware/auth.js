// rule.md section 6 mandates JWT auth on the REST API. Multi-role/user
// auth is still an open PRD question (prd.md section 9) - until that
// lands, this only checks "is this a validly-signed token", not who it
// belongs to. See routes/auth.js for how a token is issued.
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing Bearer token" });
  }
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}
