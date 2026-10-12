import { Router } from "express";
import User from "../models/User.js";
import BloodRequest from "../models/BloodRequest.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { donorProfileSchema, availabilitySchema } from "../utils/schemas.js";
import { donorGroupsFor, cooldownDate } from "../utils/matching.js";

const router = Router();
router.patch("/me", requireAuth, validate(donorProfileSchema), async (req, res, next) => {
  try {
    const update = { ...req.body };
    if ("coordinates" in update) {
      update.location = update.locationConsent ? { type: "Point", coordinates: update.coordinates } : undefined;
      delete update.coordinates;
    }
    if (update.locationConsent === false) update.location = undefined;
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true }).select("-passwordHash");
    res.json({ user });
  } catch (err) { next(err); }
});

router.patch("/availability", requireAuth, validate(availabilitySchema), async (req, res, next) => {
  try {
    if (req.body.available && (!req.user.bloodGroup || !req.user.city || !["donor", "both"].includes(req.user.role))) {
      return res.status(400).json({ message: "Complete your donor profile before becoming available" });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { available: req.body.available }, { new: true }).select("-passwordHash");
    res.json({ available: user.available });
  } catch (err) { next(err); }
});

router.get("/matches", requireAuth, async (req, res, next) => {
  try {
    if (!req.query.requestId) return res.status(400).json({ message: "requestId is required" });
    const request = await BloodRequest.findById(req.query.requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (String(request.requester) !== String(req.user._id)) return res.status(403).json({ message: "Only the request owner can view matches" });
    const query = {
      role: { $in: ["donor", "both"] }, available: true, isActive: true,
      bloodGroup: { $in: donorGroupsFor(request.bloodGroup) },
      $or: [{ lastDonationDate: { $exists: false } }, { lastDonationDate: null }, { lastDonationDate: { $lte: cooldownDate() } }]
    };
    if (request.location?.coordinates?.length === 2) {
      query.location = { $near: { $geometry: request.location, $maxDistance: 50000 } };
    } else query.city = new RegExp(`^${escapeRegex(request.city)}$`, "i");
    const donors = await User.find(query).select("name bloodGroup city").limit(50);
    res.json({ notice: "Preliminary outreach filter only. A licensed blood bank must verify suitability.", donors });
  } catch (err) { next(err); }
});

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
export default router;
