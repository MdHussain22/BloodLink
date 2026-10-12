import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import donorRoutes from "./routes/donors.js";
import requestRoutes from "./routes/requests.js";
import notificationRoutes from "./routes/notifications.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:5173")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && origin?.startsWith("http://localhost:"))) return callback(null, true);
  return callback(new Error("Origin not allowed"));
} }));
app.use(express.json({ limit: "32kb" }));
// Vercel's catch-all can pass either the full /api/... path or just the suffix.
app.use((req, _res, next) => {
  if (req.url === "/api") req.url = "/";
  else if (!req.url.startsWith("/api/")) req.url = "/api" + (req.url.startsWith("/") ? req.url : `/${req.url}`);
  next();
});
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false }));
// Serverless-safe cached connection. Do not call app.listen from the Vercel function.
app.use(async (_req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) {
    console.error("MongoDB connection failed:", err.message);
    res.status(503).json({ message: "Database connection unavailable. Check MONGODB_URI and MongoDB Atlas network access." });
  }
});
app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "BloodLink API" }));
app.use("/api/auth", (req, res, next) => {
  console.log("AUTH ROUTE REACHED:", req.method, req.originalUrl);
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use((err, _req, res, _next) => {
  if (err?.code === 11000) return res.status(409).json({ message: "That record already exists." });
  if (err?.name === "ValidationError" || err?.name === "CastError") return res.status(400).json({ message: "Invalid submitted data." });
  if (err?.message === "Origin not allowed") return res.status(403).json({ message: "Origin not allowed." });
  console.error("API error:", err?.message || "Unknown error");
  res.status(500).json({ message: "Unexpected server error. Check the server logs." });
});
export default app;
