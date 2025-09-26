const mongoose = require("mongoose");

const expenseSchema = mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: false,
    },
    participants:[{
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    }],
    isDirectExpense:{
      type:Boolean,
      default:false
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["expense", "settlement"],
      default: "expense",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
     createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true, // ✅ new field
    },
    splitAmong: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        share: {
          type: Number,
          required: true,
        },
      },
    ],
    //settlement specific
    method: {
      type: String,
      enum: ["cash", "external"],
      default: "cash",
    },
    externalProvider: {
      type: String,
      enum: ["razorpay", null],
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const expenseModel = mongoose.model("expense", expenseSchema);
module.exports = { expenseModel };
