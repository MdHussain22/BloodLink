import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Sign in required" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await User.findOne({ _id: payload.sub, isActive: true }).select("_id name email role bloodGroup city available");
    if (!user) return res.status(401).json({ message: "Account unavailable" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

// Identifies a signed-in viewer when present; allows public request browsing otherwise.
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"], issuer: "bloodlink-api", audience: "bloodlink-client" });
    const user = await User.findOne({ _id: payload.sub, isActive: true }).select("_id name email phone role bloodGroup city available");
    if (user) req.user = user;
  } catch { /* Treat invalid optional credentials as a public visitor. */ }
  next();
}
