const { blacklistModel } = require("../models/blacklistModel");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log("token received:", token);
  if (!token) return res.status(401).send({ msg: "login required" });

  const found = await blacklistModel.findOne({ token });
  if (found) return res.status(403).send({ msg: "please login again" });

  try {
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded:", decoded);
    req.userID = decoded.userID;
    req.name = decoded.name;
    req.email = decoded.email;
    // backward compat
    req.user = decoded.name;
    next();
  } catch (error) {
    console.log("JWT error:", error.message);
    res.status(403).send({ msg: "invalid or expired token" });
  }
};
module.exports = { auth };
