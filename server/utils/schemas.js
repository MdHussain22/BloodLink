import { z } from "zod";

const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const coords = z.array(z.number().finite()).length(2).refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, "Invalid longitude/latitude");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(["donor", "requester", "both"]).default("both"),
  bloodGroup: z.enum(groups).optional(),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  locationConsent: z.boolean().default(false),
  coordinates: coords.optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export const requestSchema = z.object({
  bloodGroup: z.enum(groups),
  units: z.coerce.number().int().min(1).max(10),
  hospital: z.string().trim().min(2).max(180),
  hospitalAddress: z.string().trim().max(300).optional(),
  city: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(500).optional(),
  coordinates: coords.optional()
});

export const donorProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bloodGroup: z.enum(groups).optional(),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  locationConsent: z.boolean().optional(),
  coordinates: coords.optional(),
  lastDonationDate: z.coerce.date().optional()
});

export const availabilitySchema = z.object({ available: z.boolean() });

