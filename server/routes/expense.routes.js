const express = require("express");
const { expenseModel } = require("../models/expenseModel");
const { groupModel } = require("../models/groupModel");
const { notificationModel } = require("../models/notificationModel");
const { auth } = require("../middleware/auth.middleware");
const { userModel } = require("../models/userModel");
const { activityModel } = require("../models/activityModel");
const expenseRouter = express.Router();

// Helper: send notifications to group members except actor
async function notifyGroupMembers({ group, actorId, type, message }) {
  for (let member of group.members) {
    if (member.toString() !== actorId) {
      const notification = await notificationModel.create({
        userId: member,
        type,
        message,
      });
      // ✅ Emit socket event so frontend gets it instantly
      const { io } = require("../index");
      io.to(member.toString()).emit("notification", {
        notification,
      });
    }
  }
}

//add expense
expenseRouter.post("/add", auth, async (req, res) => {
  try {
    const {
      groupId,
      participants,
      description,
      amount,
      paidBy,
      payers, // optional: [{ user, amount }]
      splitAmong,
      date,
    } = req.body;

    let group = null;
    let isDirectExpense = false;

    // Handle friend expenses (no group)
    if (!groupId && participants && participants.length === 2) {
      // Verify both participants exist
      const users = await userModel.find({ _id: { $in: participants } });
      if (users.length !== 2) {
        return res.status(400).send({ msg: "Invalid participants" });
      }
      isDirectExpense = true;
    }
    // Handle group expenses
    else if (groupId) {
      group = await groupModel
        .findById(groupId)
        .populate("members", "name email");
      if (!group) return res.status(404).send({ msg: "Group not found" });

      // Verify user is member
      if (
        !group.members.some((member) => member._id.toString() === req.userID)
      ) {
        return res
          .status(403)
          .send({ msg: "You're not a member of this group" });
      }
    } else {
      return res
        .status(400)
        .send({ msg: "Either groupId or participants required" });
    }

    // Validate payer(s)
    if ((!paidBy && !(Array.isArray(payers) && payers.length > 0)) || (paidBy && Array.isArray(payers) && payers.length > 0)) {
      // Require either single paidBy OR payers[], but not both
      return res.status(400).send({ msg: "Provide either 'paidBy' or 'payers' (not both)." });
    }

    let normalizedPayers = [];
    if (Array.isArray(payers) && payers.length > 0) {
      // Validate amounts and sum
      let sum = 0;
      for (const p of payers) {
        if (!p.user || typeof p.amount !== 'number') {
          return res.status(400).send({ msg: "Each payer must include 'user' and numeric 'amount'" });
        }
        if (p.amount < 0) {
          return res.status(400).send({ msg: "Payer amount cannot be negative" });
        }
        sum += p.amount;
      }
      if (Math.abs(sum - Number(amount)) > 0.01) {
        return res.status(400).send({ msg: "Sum of payer amounts must equal total amount" });
      }
      normalizedPayers = payers.map(p => ({ user: p.user, amount: p.amount }));
    }

    // Create expense
    const expense = new expenseModel({
      groupId: groupId || null, // null for friend expenses
      participants: participants || undefined, // for friend expenses
      description,
      amount,
      paidBy: paidBy || undefined,
      payers: normalizedPayers.length ? normalizedPayers : undefined,
      splitAmong,
      date: date || new Date(),
      createdBy: req.userID,
      isDirectExpense, // flag to identify friend expenses
    });

    await expense.save();

    // Populate the expense data
    await expense.populate([
      { path: "paidBy", select: "name email" },
      { path: "payers.user", select: "name email" },
      { path: "splitAmong.user", select: "name email" },
    ]);

    // Send notifications
    if (isDirectExpense) {
      // Notify the friend directly
      const friendId = participants.find((p) => p !== req.userID);
      if (friendId) {
        await notificationModel.create({
          userId: friendId,
          type: "expense_added",
          message: `${req.user} added a new expense: ${description}`,
          expenseId: expense._id,
        });
      }
    } else if (group) {
      // Notify group members
      await notifyGroupMembers({
        group,
        actorId: req.userID,
        type: "expense_added",
        message: `${req.user} added a new expense: ${description}`,
      });
    }

    // Create activity log
    await activityModel.create({
      user: req.userID,
      type: "expense_added",
      expense: expense._id,
      description,
      amount,
      group: groupId || null,
      // isDirectExpense,
    });

    res.status(201).send({
      msg: "Expense added successfully",
      expense,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ msg: "server error adding expense" });
  }
});
// get all expenses for logged-in user
expenseRouter.get("/all-expenses", auth, async (req, res) => {
  try {
    const userId = req.userID;
    const expenses = await expenseModel
      .find({
        $or: [
          { participants: userId }, // Direct expenses
          { "splitAmong.user": userId } // Group expenses and any expense where user has a share
        ],
        isDeleted: false,
      })
  .populate("paidBy", "name email")
  .populate("payers.user", "name email")
      .populate("createdBy", "name email")
      .populate("splitAmong.user", "name email")
      .populate("groupId", "name") // so group name comes through
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).send({ expenses });
  } catch (error) {
    console.error("Error fetching user expenses:", error);
    res.status(500).send({ msg: "server error fetching expenses" });
  }
});

//get all expenses of a group
expenseRouter.get("/group/:groupId", auth, async (req, res) => {
  try {
    const expenses = await expenseModel
      .find({ groupId: req.params.groupId, isDeleted: false })
  .populate("paidBy", "name email")
  .populate("payers.user", "name email")
      .populate("createdBy", "name email")
      .populate("splitAmong.user", "name email")
      .populate("groupId", "name")
      .sort({ createdAt: -1 }); // Sort by newest first
    res.status(200).send({ expenses });
  } catch (error) {
    res.status(500).send({ msg: "server error fetching expenses" });
  }
});

//get single expense
expenseRouter.get("/:id", auth, async (req, res) => {
  try {
    const expense = await expenseModel
      .findById(req.params.id)
      .populate("paidBy", "name email")
      .populate("createdBy", "name email")
      .populate("splitAmong.user", "name email")
      .populate("groupId", "name"); // Add group population
    if (!expense) return res.status(404).send({ msg: "expense not found" });
    res.status(200).send({ expense });
  } catch (error) {
    res.status(500).send({ msg: "error fetching expense" });
  }
});
//delete expense (only creator)
expenseRouter.delete("/:id", auth, async (req, res) => {
  try {
    const expense = await expenseModel.findById(req.params.id);
    if (!expense) return res.status(404).send({ msg: "Expense not found" });

    const isPayer = Array.isArray(expense.payers) && expense.payers.some(p => p.user.toString() === req.userID);
    if (
      (!expense.paidBy || expense.paidBy.toString() !== req.userID) &&
      expense.createdBy.toString() !== req.userID &&
      !isPayer
    ) {
      return res
        .status(403)
        .send({ msg: "Not authorized to delete this expense" });
    }
    
    // Use findByIdAndUpdate to avoid full validation on older expenses
    await expenseModel.findByIdAndUpdate(req.params.id, { isDeleted: true });

    const user = await userModel.findById(req.userID);

    // Handle group expenses
    if (expense.groupId) {
      const group = await groupModel.findById(expense.groupId, "members name");
      
      if (group) {
        // Notify group members
        await notifyGroupMembers({
          group,
          actorId: req.userID,
          type: "expense_deleted",
          message: `${user.name} deleted an expense in ${group.name}`,
        });

        //recent activity
        await activityModel.create({
          type: "expense_deleted",
          user: req.userID,
          group: expense.groupId,
          expense: expense._id,
          description: `${user.name} deleted an expense in ${group.name}`,
        });

        // ✅ Emit socket event (real-time update to group members)
        const { io } = require("../index");
        io.to(expense.groupId.toString()).emit("expense_deleted", {
          type: "expense_deleted",
          groupId: expense.groupId,
          expense,
          message: `${user.name} deleted an expense in ${group.name}`,
        });
      }
    } else {
      // Handle direct expenses (friend-to-friend)
      // Create activity for direct expense deletion
      await activityModel.create({
        type: "expense_deleted",
        user: req.userID,
        expense: expense._id,
        description: `${user.name} deleted a direct expense`,
      });
    }

    res.status(200).send({ msg: "Expense deleted successfully" });
  } catch (err) {
    console.error("Delete expense error:", err);
    res.status(500).send({ msg: "Error deleting expense" });
  }
});

//fetch recently deleted expenses
expenseRouter.get("/recent/deleted", auth, async (req, res) => {
  try {
    const expenses = await expenseModel
      .find({
        isDeleted: true,
        $or: [{ paidBy: req.userID }, { createdBy: req.userID }],
      })
  .populate("paidBy", "name email")
  .populate("payers.user", "name email")
      .populate("createdBy", "name email")
      .populate("splitAmong.user", "name email")
      .populate("groupId", "name")
      .sort({ updatedAt: -1 });

    res.status(200).send({ deletedExpenses: expenses });
  } catch (error) {
    res.status(500).send({ msg: "server error fetching deleted expenses" });
  }
});
//restore expenses api
expenseRouter.patch("/restore/:id", auth, async (req, res) => {
  try {
    const expense = await expenseModel.findById(req.params.id);
    if (!expense) return res.status(404).send({ msg: "Expense not found" });

    const isPayer = Array.isArray(expense.payers) && expense.payers.some(p => p.user.toString() === req.userID);
    if (
      (!expense.paidBy || expense.paidBy.toString() !== req.userID) &&
      expense.createdBy.toString() !== req.userID &&
      !isPayer
    ) {
      return res
        .status(403)
        .send({ msg: "Not authorized to restore this expense" });
    }

    expense.isDeleted = false;
    await expense.save();

    const group = await groupModel.findById(expense.groupId, "members name");
    const user = await userModel.findById(req.userID);

    // Notify members
    await notifyGroupMembers({
      group,
      actorId: req.userID,
      type: "expense_restored",
      message: `${user.name} restored an expense in ${group.name}`,
    });

    //recent activity
    await activityModel.create({
      type: "expense_restored",
      user: req.userID,
      group: expense.groupId,
      expense: expense._id,
      amount: expense.amount,
      description: `${user.name} restored an expense in ${group.name}`,
    });
    // ✅ Emit socket event (real-time update to group members)
    const { io } = require("../index");
    io.to(expense.groupId.toString()).emit("expense_restored", {
      type: "expense_restored",
      groupId: expense.groupId,
      expense,
      message: `${user.name} restored an expense in ${group.name}`,
    });

    res.status(200).send({ msg: "Expense restored successfully", expense });
  } catch (error) {
    res.status(500).send({ msg: "Error restoring expense" });
  }
});

module.exports = { expenseRouter };
