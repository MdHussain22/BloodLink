import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["request_nearby", "request_accepted", "request_fulfilled", "request_cancelled"], required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 300 },
  request: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest" },
  readAt: Date
}, { timestamps: true, versionKey: false });

notificationSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model("Notification", notificationSchema);
