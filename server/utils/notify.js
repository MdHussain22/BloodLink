import Notification from "../models/Notification.js";

export async function createNotification(io, { user, type, title, message, request }) {
  const notification = await Notification.create({ user, type, title, message, request });
  io?.to(`user:${String(user)}`).emit("notification:new", {
    id: String(notification._id), type, title, message, request: request ? String(request) : null,
    createdAt: notification.createdAt
  });
  return notification;
}
