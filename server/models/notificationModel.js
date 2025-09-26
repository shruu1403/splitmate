const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true, // Who receives the notification
  },
  type: {
    type: String,
    enum: [
      "expense_added",
      "expense_deleted",
      "expense_restored",
      "settlement_done",
      "group_created",
    ],
    required: true,
  },
  message: {
    type: String, // "Shruti added Dinner ₹500 in Goa Trip"
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false, // Unread until user opens it
  },
}, { timestamps: true });

const notificationModel = mongoose.model("notification", notificationSchema);
module.exports = { notificationModel };
