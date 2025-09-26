// const mongoose = require("mongoose");
// const settlementSchema = new mongoose.Schema({
//   groupId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "group",
//     required: true,
//   },
//   from: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "user",
//     required: true,
//   },
//   to: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "user",
//     required: true,
//   },
//   amount: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
//   method: {
//     type: String,
//     enum: ["cash", "external"],
//     default: "cash",
//   },
//   externalProvider: {
//     type: String,
//     enum: ["razorpay"],
//     default: null,
//   },
//   transactionId: {
//     type: String,
//     default: null,
//   },
//   status: {
//     type: String,
//     enum: ["pending", "completed", "failed"],
//     default: "completed",
//   },
// },
//     { timestamps : true}
// );

// const settlementModel = mongoose.model("settlement", settlementSchema)
// module.exports={settlementModel}