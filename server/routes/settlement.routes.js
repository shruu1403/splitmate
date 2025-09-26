const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { expenseModel } = require("../models/expenseModel");
const { userModel } = require("../models/userModel");
const { groupModel } = require("../models/groupModel");
const { notificationModel } = require("../models/notificationModel");
const { activityModel } = require("../models/activityModel");
const {calculateBalance} = require("../utils/calculateBalance")

const settlementRouter = express.Router();

// Record a new settlement
settlementRouter.post("/add", auth, async (req, res) => {
  try {
    const {
      groupId,
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

    const group = await groupModel.findById(groupId);
    if (!group) return res.status(404).send({ msg: "Group not found" });

    if (!group.members.includes(from) || !group.members.includes(to)) {
      return res.status(400).send({ msg: "Both users must be in the group" });
    }

    const fromUser = await userModel.findById(from);
    const toUser = await userModel.findById(to);
    // 🔹 Step 1: calculate current balances
    const balances = await calculateBalance(groupId);

    // 🔹 Step 2: determine actual debt from → to
    let maxDebt = 0;
    if (balances[from] < 0 && balances[to] > 0) {
      maxDebt = Math.min(Math.abs(balances[from]), balances[to]);
    }

    // 🔹 Step 3: validate settlement amount
    if (amount > maxDebt) {
      return res.status(400).json({
        msg: `Invalid settlement: ${fromUser.name} only owes ₹${maxDebt} to ${toUser.name}, cannot settle ₹${amount}`,
      });
    }
    // 👉 Save settlement as an expense
    const settlement = await expenseModel.create({
      groupId,
      type: "settlement",
      description: `Settlement: ${fromUser.name} → ${toUser.name}`,
      paidBy: from, // who paid
      amount,
      splitAmong: [{ user: to, share: amount }], // who received
      method: method || "cash",
      externalProvider: method === "external" ? externalProvider : null,
      transactionId: method === "external" ? transactionId : null,
      status: method === "cash" ? "completed" : "pending",
    });

    // Notify all
    for (let member of group.members) {
      if (member.toString() !== from) {
        const notification = await notificationModel.create({
          userId: member,
          type: "settlement_done",
          message: `${fromUser.name} settled ₹${amount} with ${toUser.name} in ${group.name}`,
        });
        const { io } = require("../index");
        io.to(member.toString()).emit("notification", { notification });
      }
    }

    // Log activity
    await activityModel.create({
      type: "settlement_done",
      user: req.userID,
      group: group._id,
      description: `${fromUser.name} paid ₹${amount} to ${toUser.name} in ${group.name}`,
    });

    const { io } = require("../index");
    io.to(groupId.toString()).emit("settlement_done", {
      groupId,
      settlement,
      message: `${fromUser.name} paid ₹${amount} to ${toUser.name} in ${group.name}`,
    });

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
