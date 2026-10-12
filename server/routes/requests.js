
import { Router } from "express";
import BloodRequest from "../models/BloodRequest.js";
import User from "../models/User.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { requestSchema } from "../utils/schemas.js";
import { donorGroupsFor, cooldownDate } from "../utils/matching.js";
import { createNotification } from "../utils/notify.js";

const router = Router();

// Preliminary red-cell compatibility filter only.
// Hospital screening and clinical crossmatching remain mandatory.
const compatibleRecipients = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"]
};

// POST /api/requests
router.post(
  "/",
  requireAuth,
  validate(requestSchema),
  async (req, res, next) => {
    try {
      const {
        bloodGroup,
        units,
        hospital,
        hospitalAddress,
        city,
        notes,
        coordinates
      } = req.body;

      // Only create GeoJSON when valid coordinates are provided.
      // City-based requests work without coordinates.
      const hasCoordinates =
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        Number.isFinite(coordinates[0]) &&
        Number.isFinite(coordinates[1]) &&
        coordinates[0] >= -180 &&
        coordinates[0] <= 180 &&
        coordinates[1] >= -90 &&
        coordinates[1] <= 90;

      const location = hasCoordinates
        ? {
            type: "Point",
            coordinates: coordinates
          }
        : undefined;

      const requestData = {
        requester: req.user._id,
        bloodGroup,
        units,
        hospital,
        hospitalAddress,
        city,
        notes
      };

      // Do not save an incomplete GeoJSON point.
      if (location) {
        requestData.location = location;
      }

      const request = await BloodRequest.create(requestData);

      const donorQuery = {
        role: { $in: ["donor", "both"] },
        available: true,
        isActive: true,
        bloodGroup: { $in: donorGroupsFor(bloodGroup) },
        $or: [
          { lastDonationDate: { $exists: false } },
          { lastDonationDate: null },
          { lastDonationDate: { $lte: cooldownDate() } }
        ]
      };

      if (location) {
        donorQuery.location = {
          $near: {
            $geometry: location,
            $maxDistance: 50000
          }
        };
      } else {
        donorQuery.city = new RegExp(
          `^${escapeRegex(city)}$`,
          "i"
        );
      }

      const donors = await User.find(donorQuery)
        .select("_id")
        .limit(100);

      const io = req.app.get("io");

      await Promise.all(
        donors.map(donor =>
          createNotification(io, {
            user: donor._id,
            type: "request_nearby",
            title: "Potential blood request nearby",
            message: `${bloodGroup} request at ${hospital}, ${city}. Open BloodLink to review.`,
            request: request._id
          })
        )
      );

      res.status(201).json({
        request,
        potentialDonorsNotified: donors.length,
        notice:
          "Matching is preliminary. Contact the hospital or blood bank directly for urgent needs."
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/requests
// Public users see request details; contact details are restricted
// to the requester and the donor who accepted the request.
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.city) {
      filter.city = new RegExp(
        `^${escapeRegex(String(req.query.city))}$`,
        "i"
      );
    }

    if (req.user) {
      filter.$or = [
        { status: { $in: ["open", "accepted"] } },
        {
          status: { $in: ["fulfilled", "cancelled"] },
          $or: [
            { requester: req.user._id },
            { acceptedBy: req.user._id }
          ]
        }
      ];
    } else {
      filter.status = { $in: ["open", "accepted"] };
    }

    const requests = await BloodRequest.find(filter)
      .populate("requester", "name email phone")
      .populate("acceptedBy", "name email phone")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(
      requests.map(request =>
        serializeRequest(request, req.user)
      )
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/requests/:id
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate("requester", "name email phone")
      .populate("acceptedBy", "name email phone");

    if (!request) {
      return res.status(404).json({
        message: "Request not found"
      });
    }

    res.json({
      request: serializeRequest(request, req.user)
    });
  } catch (error) {
    next(error);
  }
});

function serializeRequest(document, viewer) {
  const request = document.toObject();

  const requester = request.requester;
  const donor = request.acceptedBy;

  const requesterId = String(requester?._id || requester || "");
  const donorId = String(donor?._id || donor || "");
  const viewerId = viewer ? String(viewer._id) : "";

  const isRequester = Boolean(
    viewerId && viewerId === requesterId
  );

  const isAcceptedDonor = Boolean(
    viewerId && viewerId === donorId
  );

  delete request.requester;
  delete request.acceptedBy;

  request.viewer = {
    isRequester,
    isAcceptedDonor,
    isParticipant: isRequester || isAcceptedDonor
  };

  if (
    ["accepted", "fulfilled"].includes(request.status) &&
    (isRequester || isAcceptedDonor)
  ) {
    request.contacts = {
      requester:
        requester && typeof requester === "object"
          ? contactCard(requester)
          : null,
      donor:
        donor && typeof donor === "object"
          ? contactCard(donor)
          : null
    };
  }

  return request;
}

function contactCard(person) {
  return {
    name: person.name,
    phone: person.phone || null,
    email: person.email || null
  };
}

// POST /api/requests/:id/accept
// Accepting creates a match; it does not complete the request.
router.post("/:id/accept", requireAuth, async (req, res, next) => {
  try {
    if (!["donor", "both"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only registered donors can accept requests"
      });
    }

    const donor = await User.findById(req.user._id);

    if (
      !donor ||
      !donor.available ||
      !donor.bloodGroup ||
      !donor.city
    ) {
      return res.status(400).json({
        message:
          "Complete your donor profile and enable availability first"
      });
    }

    const request = await BloodRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "open",
        city: new RegExp(
          `^${escapeRegex(donor.city)}$`,
          "i"
        ),
        bloodGroup: {
          $in: compatibleRecipients[donor.bloodGroup] || []
        }
      },
      {
        $set: {
          status: "accepted",
          acceptedBy: donor._id,
          acceptedAt: new Date()
        }
      },
      { new: true }
    );

    if (!request) {
      return res.status(409).json({
        message:
          "This request is no longer open or does not match your city/blood group"
      });
    }

    await createNotification(req.app.get("io"), {
      user: request.requester,
      type: "request_accepted",
      title: "A donor responded",
      message:
        "A donor accepted your request. Sign in to view matched contact details.",
      request: request._id
    });

    res.json({
      message:
        "Request matched. Both parties can view available contact details.",
      request: {
        id: request._id,
        status: request.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/requests/:id/fulfill
// Only the requester can confirm completion.
router.post("/:id/fulfill", requireAuth, async (req, res, next) => {
  try {
    const request = await BloodRequest.findOne({
      _id: req.params.id,
      requester: req.user._id,
      status: "accepted"
    });

    if (!request) {
      return res.status(404).json({
        message:
          "Matched request not found for this requester account"
      });
    }

    request.status = "fulfilled";
    request.fulfilledAt = new Date();

    await request.save();

    if (request.acceptedBy) {
      await createNotification(req.app.get("io"), {
        user: request.acceptedBy,
        type: "request_fulfilled",
        title: "Request marked fulfilled",
        message:
          "The requester confirmed this request as completed.",
        request: request._id
      });
    }

    res.json({
      message: "Request marked fulfilled.",
      request
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/requests/:id/cancel
router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const request = await BloodRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        requester: req.user._id,
        status: { $in: ["open", "accepted"] }
      },
      {
        $set: { status: "cancelled" }
      },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({
        message:
          "Open or matched request not found for this account"
      });
    }

    if (request.acceptedBy) {
      await createNotification(req.app.get("io"), {
        user: request.acceptedBy,
        type: "request_cancelled",
        title: "Request cancelled",
        message: "The requester cancelled this blood request.",
        request: request._id
      });
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default router;
