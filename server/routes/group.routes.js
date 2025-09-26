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
    const group = new groupModel({
      name,
      members: [...members, req.userID], //include creator of group automatcally
      createdBy: req.userID,
    });
    await group.save();

    const creator = await userModel.findById(req.userID);

    //notify all except creator
    for (let member of group.members) {
      if (member.toString() !== req.userID.toString()) {
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
      description: `${creator.name} created the group ${group.name}`,
    });

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
// groupRouter.delete("/:id", auth, async (req, res) => {
//   try {
//     const group = await groupModel.findById(req.params.id);
//     if (!group) return res.status(404).send({ msg: "group not found" });

//     if (group.createdBy.toString() !== req.userID) {
//       return res
//         .status(403)
//         .send({ msg: "only creator can delete this group" });
//     }
//     // Delete all expenses of this group
//     // await expenseModel.deleteMany({ groupId: req.params.id });
//     await group.deleteOne();
//     res.status(200).send({ msg: "group deleted successfully" });
//   } catch (error) {
//     res.status(500).send({ msg: "error deleting group" });
//   }
// });

module.exports = { groupRouter };
