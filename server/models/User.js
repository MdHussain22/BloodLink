import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coordinates) => coordinates.length === 2,
        message: "Coordinates must contain longitude and latitude"
      }
    }
  },
  { _id: false }
);


const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["donor", "requester", "both"], default: "both" },
  bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
  city: { type: String, trim: true, maxlength: 100 },
 
location: {
  type: pointSchema,
  default: undefined
},

  locationConsent: { type: Boolean, default: false },
  available: { type: Boolean, default: false },
  lastDonationDate: Date,
  phone: { type: String, trim: true, maxlength: 30 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

userSchema.index({ location: "2dsphere" });
userSchema.index({ city: 1, bloodGroup: 1, available: 1 });

export default mongoose.model("User", userSchema);
