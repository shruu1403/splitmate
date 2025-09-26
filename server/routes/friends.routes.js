const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { inviteModel } = require("../models/inviteModel");
const { userModel } = require("../models/userModel");
const { expenseModel } = require("../models/expenseModel");
const friendRouter = express.Router();
const mongoose = require("mongoose");
const { groupModel } = require("../models/groupModel");

friendRouter.get("/", auth, async (req, res) => {
  try {
    const userId = req.userID;
    const search = (req.query.search || "").toLowerCase();

    // Find accepted friend invites (group=null)
    const invites = await inviteModel
      .find({
        $or: [
          { invitedBy: userId }, // user sent invite
          { email: (await userModel.findById(userId)).email }, // user received invite
        ],
        group: null,
        status: "accepted",
      })
      .populate("invitedBy", "name email");

    let friends = [];

    for (const inv of invites) {
      if (inv.invitedBy._id.toString() === userId) {
        // user invited someone → friend is by email
        const friend = await userModel.findOne(
          { email: inv.email },
          "name email"
        );
        if (friend) friends.push(friend);
      } else {
        // user was invited → friend is invitedBy
        friends.push(inv.invitedBy);
      }
    }

    // Deduplicate
    const uniqueFriends = [];
    const seen = new Set();
    friends.forEach((friend) => {
      if (!seen.has(friend._id.toString())) {
        seen.add(friend._id.toString());
        uniqueFriends.push(friend);
      }
    });

    // Optional search filter
    let filtered = uniqueFriends;
    if (search) {
      filtered = uniqueFriends.filter(
        (f) =>
          f.name.toLowerCase().includes(search) ||
          f.email.toLowerCase().includes(search)
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

friendRouter.get("/:friendId", auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userID;
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ msg: "Invalid friendId" });
    }

    // Get friend info
    const friend = await userModel.findById(friendId).select("name email");
    if (!friend) return res.status(404).json({ msg: "Friend not found" });

    const directExpenses = await expenseModel
      .find({
        isDeleted: false,
        isDirectExpense: true,
        participants: { $all: [userId, friendId] },
      })
      .populate("paidBy", "name email")
      .populate("splitAmong.user", "name email")
      .sort({ createdAt: -1 });

    // Groups where both are members
    const groups = await groupModel
      .find({ members: { $all: [userId, friendId] } })
      .select("name");

    // Calculate balance
    let balance = 0;
    directExpenses.forEach((exp) => {
      exp.splitAmong.forEach((split) => {
        const splitUserId = split.userID
          ? split.userID.toString()
          : split.user.toString();
        if (splitUserId === userId) {
          balance -= split.amount;
        }
        if (splitUserId === friendId) {
          balance += split.amount;
        }
      });
    });

    res.json({
      friend: {
        _id: friend._id,
        name: friend.name,
        email: friend.email,
        expenses: directExpenses,
        balance,
        groups,
      },
    });
  } catch (err) {
    console.error("Error in GET /friend/:friendId", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = { friendRouter };
