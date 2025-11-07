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

    // Base: user.friends list
    const me = await userModel.findById(userId).select("email friends");
    const friendIdSet = new Set((me?.friends || []).map((id) => id.toString()));

    // Compat: accepted friend invites (group=null)
    const invites = await inviteModel
      .find({
        $or: [
          { invitedBy: userId }, // user sent invite
          { email: me?.email }, // user received invite
        ],
        group: null,
        status: "accepted",
      })
      .populate("invitedBy", "name email");

    for (const inv of invites) {
      if (inv.invitedBy._id.toString() === userId) {
        // user invited someone → friend is by email
        const friend = await userModel.findOne({ email: inv.email }).select("_id");
        if (friend) friendIdSet.add(friend._id.toString());
      } else {
        // user was invited → friend is invitedBy
        friendIdSet.add(inv.invitedBy._id.toString());
      }
    }

    const friendIds = Array.from(friendIdSet);
    const friends = await userModel
      .find({ _id: { $in: friendIds } })
      .select("name email");

    // Optional search filter
    const filtered = search
      ? friends.filter(
          (f) =>
            f.name.toLowerCase().includes(search) ||
            f.email.toLowerCase().includes(search)
        )
      : friends;

    res.json(filtered);
  } catch (err) {
    console.error("Error in GET /friend", err);
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
      const paidById = exp.paidBy._id ? exp.paidBy._id.toString() : exp.paidBy.toString();
      
      exp.splitAmong.forEach((split) => {
        const splitUserId = split.user._id ? split.user._id.toString() : split.user.toString();
        const splitAmount =  split.share;
        
        if (splitUserId === userId) {
          // Current user's share of the expense
          if (paidById === userId) {
            // User paid and owes this amount - net effect is getting back (expense - own share)
            balance += (exp.amount - splitAmount);
          } else {
            // User didn't pay but owes this amount
            balance -= splitAmount;
          }
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

// DELETE friend: remove both sides of friendship and mark accepted friend-invites as rejected
friendRouter.delete('/:friendId', auth, async (req, res) => {
  try {
    const userId = req.userID;
    const { friendId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ msg: 'Invalid friendId' });
    }

    const me = await userModel.findById(userId);
    const friend = await userModel.findById(friendId);
    if (!me || !friend) return res.status(404).json({ msg: 'User not found' });

    me.friends = (me.friends || []).filter(id => id.toString() !== friendId);
    friend.friends = (friend.friends || []).filter(id => id.toString() !== userId);

    await me.save();
    await friend.save();

    // Mark any accepted friend invites between them as rejected to avoid re-surfacing
    await inviteModel.updateMany(
      {
        status: 'accepted',
        group: null,
        $or: [
          { invitedBy: userId, email: friend.email },
          { invitedBy: friendId, email: me.email }
        ]
      },
      { $set: { status: 'rejected' } }
    );

    // Emit socket update to both
    try {
      const { io } = require('../index');
      io.to(userId.toString()).emit('friends_updated');
      io.to(friendId.toString()).emit('friends_updated');
    } catch (e) {
      console.warn('Socket emit failed for friends_updated:', e.message);
    }

    res.json({ msg: 'Friend removed' });
  } catch (err) {
    console.error('Error deleting friend:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});
