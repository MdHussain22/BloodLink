import { Router } from "express";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ notifications });
  } catch (err) { next(err); }
});
router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { readAt: new Date() } }, { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification });
  } catch (err) { next(err); }
});
export default router;
