
import app from "../server/app.js";

export default function handler(req, res) {
  console.log("VERCEL API ENTRY:", req.method, req.url);
  return app(req, res);
}
