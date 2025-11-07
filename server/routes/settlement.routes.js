const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { expenseModel } = require("../models/expenseModel");
const { userModel } = require("../models/userModel");
const { groupModel } = require("../models/groupModel");
const { notificationModel } = require("../models/notificationModel");
const { activityModel } = require("../models/activityModel");
const crypto = require("crypto");

const settlementRouter = express.Router();


// Record a new settlement
settlementRouter.post("/add", auth, async (req, res) => {
  try {
    const {
      groupId,
      participants, // For direct friend settlements
      from,
      to,
      amount,
      method,
      externalProvider,
      transactionId,
    } = req.body;

    if (from === to) {
      return res
        .status(400)
        .send({ msg: "From and To users cannot be the same" });
    }
    if (amount <= 0) {
      return res.status(400).send({ msg: "Amount must be greater than 0" });
    }

    let group = null;
    let isDirectSettlement = false;

    // Handle direct friend settlements (no group)
    if (!groupId && participants && participants.length === 2) {
      const users = await userModel.find({ _id: { $in: participants } });
      if (users.length !== 2) {
        return res.status(400).send({ msg: "Invalid participants" });
      }
      // Verify from and to are in participants
      if (!participants.includes(from) || !participants.includes(to)) {
        return res.status(400).send({ msg: "From and To must be in participants" });
      }
      isDirectSettlement = true;
    }
    // Handle group settlements
    else if (groupId) {
      group = await groupModel.findById(groupId);
      if (!group) return res.status(404).send({ msg: "Group not found" });

      if (!group.members.includes(from) || !group.members.includes(to)) {
        return res.status(400).send({ msg: "Both users must be in the group" });
      }
    } else {
      return res.status(400).send({ msg: "Either groupId or participants required" });
    }

    const fromUser = await userModel.findById(from);
    const toUser = await userModel.findById(to);
    
    if (!fromUser || !toUser) {
      return res.status(404).send({ msg: "User not found" });
    }
    
    // Save settlement as an expense
    const settlement = await expenseModel.create({
      groupId: groupId || null, // null for direct friend settlements
      participants: participants || undefined, // for direct friend settlements
      isDirectExpense: isDirectSettlement, // Mark as direct expense if no group
      type: "settlement",
      description: `Settlement: ${fromUser.name} → ${toUser.name}`,
      paidBy: from,
      createdBy: req.userID,
      amount,
      splitAmong: [{ user: to, share: amount }],
      method: method || "cash",
      externalProvider: method === "external" ? externalProvider : null,
      transactionId: method === "external" ? transactionId : null,
      status: method === "cash" ? "completed" : "pending",
    });

    const { io } = require("../index");

    // Handle notifications differently for group vs direct settlements
    if (group && group.members) {
      // Group settlement - notify all members
      for (let member of group.members) {
        if (member.toString() !== from) {
          const notification = await notificationModel.create({
            userId: member,
            type: "settlement_done",
            message: `${fromUser.name} settled ₹${amount} with ${toUser.name} in ${group.name}`,
          });
          io.to(member.toString()).emit("notification", { notification });
        }
      }

      // Log activity for group
      await activityModel.create({
        type: "settlement_done",
        user: req.userID,
        group: group._id,
        description: `${fromUser.name} paid ₹${amount} to ${toUser.name} in ${group.name}`,
      });

      // Emit settlement event to group room
      io.to(groupId.toString()).emit("settlement_done", {
        groupId,
        settlement,
        message: `${fromUser.name} paid ₹${amount} to ${toUser.name} in ${group.name}`,
      });
    } else {
      // Direct friend settlement - notify only the 'to' user
      const notification = await notificationModel.create({
        userId: to,
        type: "settlement_done",
        message: `${fromUser.name} settled ₹${amount} with you`,
      });
      io.to(to.toString()).emit("notification", { notification });

      // Log activity for friend settlement
      await activityModel.create({
        type: "settlement_done",
        user: req.userID,
        settlement: settlement._id,
        description: `${fromUser.name} paid ₹${amount} to ${toUser.name}`,
      });

      // Emit settlement event to both users
      io.to(from.toString()).emit("settlement_recorded", { settlement });
      io.to(to.toString()).emit("settlement_recorded", { settlement });
    }

    res.status(201).send({ msg: "Settlement recorded", settlement });
  } catch (error) {
    res
      .status(500)
      .send({ msg: "Error creating settlement", error: error.message });
  }
});

// Get all settlements for a group
settlementRouter.get("/group/:groupId", auth, async (req, res) => {
  try {
    const settlements = await expenseModel
      .find({ groupId: req.params.groupId, type: "settlement" })
      .populate("paidBy", "name email")
      .populate("splitAmong.user", "name email");

    res.status(200).send({ settlements });
  } catch (error) {
    res.status(500).send({ msg: "Error fetching settlements" });
  }
});

// Get settlements involving a user
settlementRouter.get("/user/:userId", auth, async (req, res) => {
  try {
    const settlements = await expenseModel
      .find({
        type: "settlement",
        $or: [
          { paidBy: req.params.userId },
          { "splitAmong.user": req.params.userId },
        ],
      })
      .populate("paidBy", "name email")
      .populate("splitAmong.user", "name email");

    res.status(200).send({ settlements });
  } catch (error) {
    res.status(500).send({ msg: "Error fetching user settlements" });
  }
});

// Get settlements between two friends (direct friend settlements)
settlementRouter.get("/friends", auth, async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    
    if (!user1 || !user2) {
      return res.status(400).send({ msg: "Both user1 and user2 are required" });
    }

    // Find all settlements between these two users (both directions)
    const settlements = await expenseModel
      .find({
        type: "settlement",
        isDirectExpense: true, // Only direct friend settlements
        $or: [
          { paidBy: user1, "splitAmong.user": user2 },
          { paidBy: user2, "splitAmong.user": user1 },
        ],
      })
      .populate("paidBy", "name email")
      .populate("splitAmong.user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).send({ settlements });
  } catch (error) {
    console.error("Error fetching friend settlements:", error);
    res.status(500).send({ msg: "Error fetching friend settlements" });
  }
});

// Update settlement status (mainly for external payments -> completed/failed)
settlementRouter.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status, transactionId } = req.body;

    const settlement = await expenseModel.findOne({
      _id: req.params.id,
      type: "settlement",
    });
    if (!settlement)
      return res.status(404).send({ msg: "Settlement not found" });

    if (status) settlement.status = status;
    if (transactionId) settlement.transactionId = transactionId;

    await settlement.save();
    res.status(200).send({ msg: "Settlement updated", settlement });
  } catch (error) {
    res.status(500).send({ msg: "Error updating settlement status" });
  }
});

module.exports = { settlementRouter };
