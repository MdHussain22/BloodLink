
import mongoose from "mongoose";

let connectionPromise = null;

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  // Reuse an existing connection in serverless environments.
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Reuse an ongoing connection attempt.
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      })
      .then(() => {
        console.log("MongoDB connected");
      })
      .catch((err) => {
        connectionPromise = null;
        throw err;
      });
  }

  await connectionPromise;
}
