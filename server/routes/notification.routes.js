const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { notificationModel } = require("../models/notificationModel");
const { io } = require("../index");
const notificationRouter = express.Router();

// Get all notifications for logged-in user
notificationRouter.get("/", auth, async (req, res) => {
  try {
    const notifications = await notificationModel
      .find({ userId: req.userID })
      .sort({ createdAt: -1 });
    res.status(200).send({ notifications });
  } catch (error) {
    res.status(500).send({ msg: "Error fetching notifications" });
  }
});

// Mark single notification as read
notificationRouter.patch("/:id/read", auth, async (req, res) => {
  try {
    const notif = await notificationModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userID },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).send({ msg: "Notification not found" });
    res.status(200).send({ msg: "Notification marked as read", notif });
  } catch (error) {
    res.status(500).send({ msg: "Error updating notification" });
  }
});

// Mark all notifications as read
notificationRouter.patch("/read-all", auth, async (req, res) => {
  try {
    await notificationModel.updateMany(
      { userId: req.userID, isRead: false },
      { isRead: true }
    );
    res.status(200).send({ msg: "All notifications marked as read" });
  } catch (error) {
    res.status(500).send({ msg: "Error updating notifications" });
  }
});


module.exports = { notificationRouter };
