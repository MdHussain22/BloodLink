import "dotenv/config";

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import app from "./server/app.js";
import { connectDB } from "./server/config/db.js";

const port = Number(process.env.PORT || 5000);

connectDB()
  .then(() => app.listen(port, () =>
    console.log(`BloodLink API: http://localhost:${port}/api/health`)
  ))
  .catch(error => {
    console.error("Startup failed:", error.message);
    process.exit(1);
  });