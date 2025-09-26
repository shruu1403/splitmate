const express = require("express");
const { auth } = require("../middleware/auth.middleware");
const { calculateBalance } = require("../utils/calculateBalance");
const { groupModel } = require("../models/groupModel");

const balanceRouter = express.Router();

//balance for a specific group
balanceRouter.get("/:groupId", auth, async (req, res) => {
  try {
    const { groupId } = req.params;

    // ensure group exists
    const group = await groupModel
      .findById(groupId)
      .populate("members", "name email");
    if (!group) return res.status(404).send({ msg: "Group not found" });

    // calculate balances
    const balances = await calculateBalance(groupId);

    res.status(200).send({
      group: group.name,
      balances,
    });
  } catch (error) {
    res
      .status(500)
      .send({ msg: "Error fetching balance", error: error.message });
  }
});

//overall balance of all groups
balanceRouter.get("/overall/me", auth, async (req, res) => {
  try {
    const userId = req.userID;

    // find groups where this user is a member
    const groups = await groupModel.find({ members: userId });

    let overall = 0;
    let youOwe = 0;
    let youAreOwed = 0;
    const perGroup = [];

    for (const group of groups) {
      const balances = await calculateBalance(group._id);

      // if (balances[userId]) {
      //   overall += balances[userId];
      // }

      const myBalance = balances[userId] !== undefined ? balances[userId] : 0;
      overall += myBalance;

      if (myBalance < 0) youOwe += Math.abs(myBalance);
      if (myBalance > 0) youAreOwed += myBalance;

      perGroup.push({
        groupId: group._id,
        groupName: group.name,
        myBalance,
      });
    }

    res.status(200).send({
      overallBalance: overall,
      youOwe,
      youAreOwed,
      breakdown: perGroup,
    });
  } catch (error) {
    res
      .status(500)
      .send({ msg: "Error fetching overall balance", error: error.message });
  }
});

module.exports = { balanceRouter };
