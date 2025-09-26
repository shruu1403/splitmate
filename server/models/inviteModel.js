const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true }, // target user email
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true }, // inviter
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      default: null, // null means it's a FRIEND invite, not group-specific
    },
    token: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const inviteModel = mongoose.model("invite", inviteSchema);

module.exports = { inviteModel };
