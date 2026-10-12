import mongoose from "mongoose";

const bloodRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], required: true },
  units: { type: Number, min: 1, max: 10, required: true },
  hospital: { type: String, required: true, trim: true, maxlength: 180 },
  hospitalAddress: { type: String, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
 location: {
  type: {
    type: String,
    enum: ["Point"]
  },
  coordinates: {
    type: [Number],
    default: undefined
  }
},
  notes: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ["open", "accepted", "fulfilled", "cancelled"], default: "open", index: true },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  acceptedAt: Date,
  fulfilledAt: Date
}, { timestamps: true, versionKey: false });

bloodRequestSchema.index({ location: "2dsphere" });
bloodRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("BloodRequest", bloodRequestSchema);
