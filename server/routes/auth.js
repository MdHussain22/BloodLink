import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../utils/schemas.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
function issueToken(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "2h", issuer: "bloodlink-api", audience: "bloodlink-client" });
}
function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, bloodGroup: user.bloodGroup, city: user.city, available: user.available, locationConsent: user.locationConsent };
}

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, bloodGroup, city, phone, locationConsent, coordinates } = req.body;
    const normalizedEmail = email.toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: "An account with this email already exists" });
    const location = locationConsent && coordinates ? { type: "Point", coordinates } : undefined;
    const user = await User.create({
      name, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12),
      role, bloodGroup, city, phone, locationConsent, location
    });
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), isActive: true }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, async (req, res) => res.json({ user: publicUser(req.user) }));
export default router;
