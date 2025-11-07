const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { activityModel } = require("../models/activityModel");

const activityRouter = express.Router();

//recent activity of a user
activityRouter.get("/recent-activity", auth, async (req, res) => {
    try {
    const userId = req.userID; // Fixed: was req.userId, should be req.userID
    
    // Get user's groups to filter relevant activities
    const { groupModel } = require("../models/groupModel");
    const userGroups = await groupModel.find({ members: userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);
    
    //find activities from groups where user is a member OR activities by the user
    const activities = await activityModel
      .find({
        $or: [
          { user: userId }, // Activities by the user
          { group: { $in: groupIds } } // Activities in user's groups
        ]
      })
      .populate("user", "name email")
      .populate("group", "name")
      .populate({
        path: "expense",
        select: "description amount participants paidBy createdBy splitAmong isDirectExpense",
        populate: [
          { path: "participants", select: "name" },
          { path: "paidBy", select: "name" },
          { path: "createdBy", select: "name" },
          { path: "splitAmong.user", select: "name" }
        ]
      })
      .populate({
        path: "settlement",
        select: "amount paidBy splitAmong participants isDirectExpense",
        populate: [
          { path: "participants", select: "name" },
          { path: "paidBy", select: "name" },
          { path: "splitAmong.user", select: "name" }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(20);
      
      res.status(200).send(activities);
    } catch (error) {
        res.status(500).send({ msg: "Error fetching recent activity", error: error.message })
    }
});

module.exports = { activityRouter };