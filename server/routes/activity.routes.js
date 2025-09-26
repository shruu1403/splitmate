const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { activityModel } = require("../models/activityModel");

const activityRouter = express.Router();

//recent activity of a user
activityRouter.get("/recent-activity", auth, async (req, res) => {
    try {
    const userId = req.userId;
    //find activities from group where user is a member
    const activities = await activityModel
    .find()
      .populate("user", "name email")
      .populate("group", "name")
      .populate("expense", "description amount")
      .sort({ createdAt: -1 })
      .limit(20);
      res.status(200).send(activities)
    } catch (error) {
        res.status(500).send({ msg: "Error fetching recent activity", error: error.message })
    }
});

module.exports = { activityRouter };