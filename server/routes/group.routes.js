const express = require("express");
const { groupModel } = require("../models/groupModel");
const { userModel } = require("../models/userModel");
const { auth } = require("../middleware/auth.middleware");
const { notificationModel } = require("../models/notificationModel");
const { activityModel } = require("../models/activityModel");
const groupRouter = express.Router();

//create a group
groupRouter.post("/add", auth, async (req, res) => {
  try {
    const { name, members } = req.body;
    // Sanitize incoming members (client should send only ObjectIds of existing users)
    const cleanMembers = Array.isArray(members)
      ? members.filter(Boolean).map((m) => m.toString())
      : [];

    const group = new groupModel({
      name,
      members: [...cleanMembers, req.userID], // include creator automatically
      createdBy: req.userID,
    });
    await group.save();

    const creator = await userModel.findById(req.userID);

    //notify all except creator
    for (let member of group.members) {
      if (member && member.toString && member.toString() !== req.userID.toString()) {
        const notification = await notificationModel.create({
          userId: member,
          type: "group_created",
          message: `You were added to a new group ${group.name} by ${creator.name}`,
        });
        // ✅ Emit socket event directly to the member
        const { io } = require("../index");
        io.to(member.toString()).emit("notification", {
          notification,
          group,
          message: `You were added to a new group ${group.name} by ${creator.name}`,
        });
      }
    }
    //recent activity
    await activityModel.create({
      type: "group_created",
      user: req.userID,
      group: group._id,
      description: `created the group "${group.name}"`,
    });

    // Emit real-time updates for group creation
    const { io } = require("../index");
    console.log("🔄 Emitting group creation events to members:", group.members.map(m => m.toString()));
    
    // Emit to all members so sidebar updates instantly
    for (let member of group.members) {
      console.log(`📡 Emitting to member ${member.toString()}: group_created, activity_updated`);
      io.to(member.toString()).emit("group_created", {
        group: group,
        createdBy: creator.name
      });
      // Also emit activity update for Recent Activity page
      io.to(member.toString()).emit("activity_updated");
    }

    res.status(201).send({ msg: "group created successfully", group });
  } catch (error) {
    console.log(error);
    res.status(500).send({ msg: "server error creating group" });
  }
});

//get all groups of logged in user
groupRouter.get("/", auth, async (req, res) => {
  try {
    const groups = await groupModel
      .find({ members: req.userID })
      .populate("members", "name email");
    res.status(200).send({ groups });
  } catch (error) {
    res.status(500).send({ msg: "server error fetching groups" });
  }
});
//get single group details
groupRouter.get("/:id", auth, async (req, res) => {
  try {
    const group = await groupModel
      .findById(req.params.id)
      .populate("members", "name email");
    if (!group) return res.status(404).send({ msg: "group not found" });
    res.status(200).send({ group });
  } catch (error) {
    res.status(500).send({ msg: "error fetching group" });
  }
});
//delete group (only creator)
groupRouter.delete("/:id", auth, async (req, res) => {
  try {
    const group = await groupModel.findById(req.params.id);
    if (!group) return res.status(404).send({ msg: "group not found" });

    if (group.createdBy.toString() !== req.userID) {
      return res
        .status(403)
        .send({ msg: "only creator can delete this group" });
    }

    const creator = await userModel.findById(req.userID);
    
    // Store group data before deletion
    const groupData = {
      _id: group._id,
      name: group.name,
      members: [...group.members]
    };

    // TODO: Delete all expenses of this group when needed
    // await expenseModel.deleteMany({ groupId: req.params.id });
    
    // Delete the group first
    await group.deleteOne();

    // Only create activity log after successful deletion
    await activityModel.create({
      type: "group_deleted",
      user: req.userID,
      group: groupData._id,
      description: `deleted the group "${groupData.name}"`,
    });

    // Emit socket events after successful deletion
    if (req.io) {
      // Emit to all members of the group
      for (let member of groupData.members) {
        req.io.to(member.toString()).emit("group_deleted", {
          groupId: groupData._id,
          groupName: groupData.name,
          deletedBy: creator.name
        });
        // Also emit activity update so Recent Activity page refreshes
        req.io.to(member.toString()).emit("activity_updated");
      }
    }
    
    res.status(200).send({ msg: "group deleted successfully", groupId: groupData._id });
  } catch (error) {
    console.log("Error deleting group:", error);
    res.status(500).send({ msg: "error deleting group" });
  }
});

module.exports = { groupRouter };
