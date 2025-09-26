const express = require("express");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { inviteModel } = require("../models/inviteModel");
const { userModel } = require("../models/userModel");
const { groupModel } = require("../models/groupModel");
const { sendEmail } = require("../utils/sendEmail");
const { auth } = require("../middleware/auth.middleware");

const inviteRouter = express.Router();

/**
 * 📩 Send Invite
 * - If groupId is provided → Group Invite
 * - If groupId is null → Friend Invite
 */
inviteRouter.post("/send", auth, async (req, res) => {
  try {
    const { email, groupId } = req.body;

    const inviter = await userModel.findById(req.userID);
    if (!inviter) return res.status(404).send({ msg: "Inviter not found" });

    // Generate magic link token
    const token = jwt.sign({ email, groupId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

console.log("✅ Generated invite token:", token);  // LOG #1


    // Save invite in DB
    const invite = await inviteModel.create({
      email,
      invitedBy: inviter._id,
      group: groupId || null,
      token,
    });

    // Magic link
    const magicLink = `${process.env.CLIENT_URL}/invite/accept?token=${token}`;

    // Prepare email
    let subject, html;
    if (groupId) {
      const group = await groupModel.findById(groupId);
      subject = `Invitation to join group "${group.name}"`;
      html = `
        <p>Hi,</p>
        <p>${inviter.name} has invited you to join the group <b>${group.name}</b>.</p>
        <p>Click below to accept:</p>
        <a href="${magicLink}" target="_blank">Join Group</a>
      `;
    } else {
      subject = `Invitation to join SplitMate as a friend`;
      html = `
        <p>Hi,</p>
        <p>${inviter.name} has invited you to connect on SplitMate.</p>
        <p>Click below to accept:</p>
        <a href="${magicLink}" target="_blank">Accept Invite</a>
      `;
    }

    // Send email
    await sendEmail({ to: email, subject, html });

    res.status(200).send({ msg: "Invite sent successfully", invite });
  } catch (err) {
    console.error(err);
    res.status(500).send({ msg: "Error sending invite" });
  }
});

/**
 * 🔗 Generate Magic Link (without sending email)
 */
inviteRouter.post("/generate-link", auth, async (req, res) => {
  try {
    const { groupId } = req.body;

    const token = jwt.sign({ groupId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const invite = await inviteModel.create({
      email: null,
      invitedBy: req.userID,
      group: groupId,
      token,
    });

    const magicLink = `${process.env.CLIENT_URL}/invite/accept?token=${token}`;

    res.status(200).send({
      msg: "Magic link generated",
      link: magicLink,
      inviteId: invite._id,
    });
  } catch (err) {
    res.status(500).send({ msg: "Error generating link", error: err.message });
  }
});

/**
 * ✅ Accept Invite
 * - If groupId present → add to group
 * - Else → make inviter & invited user friends
 */
inviteRouter.post("/accept", auth, async (req, res) => {
  try {
    const inviteToken = req.body.token;   // 🎯 from magic link
    const userId = req.userID;            // 🎯 from auth middleware

    console.log("📥 Invite token received in backend:", inviteToken);
    console.log("👤 Authenticated user:", userId);

    // 1. Verify invite token
    let decodedInvite;
    try {
      decodedInvite = jwt.verify(inviteToken, process.env.JWT_SECRET);
      console.log("✅ Invite decoded:", decodedInvite);
    } catch (err) {
      console.error("❌ Invalid invite token:", err.message);
      return res.status(400).send({ msg: "Invalid or expired invite token" });
    }

    // 2. Find invite in DB
    const invite = await inviteModel.findOne({ token: inviteToken, status: "pending" });
    console.log("🔎 Invite found in DB:", invite);
    if (!invite) {
      return res.status(400).send({ msg: "Invalid or already accepted invite" });
    }

    // 3. Handle Group Invite
    if (decodedInvite.groupId) {
      const group = await groupModel.findById(decodedInvite.groupId);
      if (!group) return res.status(404).send({ msg: "Group not found" });

      if (!group.members.includes(userId)) {
        group.members.push(userId);
        await group.save();
      }
    } 
    // 4. Handle Friend Invite
    else {
      const inviter = await userModel.findById(invite.invitedBy);
      const invitedUser = await userModel.findById(userId);

      if (!inviter || !invitedUser) {
        return res.status(404).send({ msg: "User not found" });
      }

      inviter.friends = inviter.friends || [];
      invitedUser.friends = invitedUser.friends || [];

      if (!inviter.friends.includes(invitedUser._id)) {
        inviter.friends.push(invitedUser._id);
      }
      if (!invitedUser.friends.includes(inviter._id)) {
        invitedUser.friends.push(inviter._id);
      }

      await inviter.save();
      await invitedUser.save();
    }

    // 5. Mark invite accepted
    invite.status = "accepted";
    await invite.save();

    res.status(200).send({
      msg: "Invite accepted successfully",
      groupId: decodedInvite.groupId || null,
    });
  } catch (err) {
    console.error("❌ Error in /invite/accept:", err.message);
    res.status(500).send({ msg: "Error accepting invite", error: err.message });
  }
});


module.exports = { inviteRouter };
