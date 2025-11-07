const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "expense_added",
        "expense_restored",
        "expense_deleted",
        "settlement_done",
        "group_created",
        "group_deleted",
      ],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: false,
    },
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "expense",
    },
    settlement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "expense", // settlements are stored as expenses with type="settlement"
    },
    amount: {    //for settlement and non expense activities
      type: Number,
      default: 0,
    },
    description: String,
  },
  { timestamps: true }
);
const activityModel = mongoose.model("activity", activitySchema)
module.exports={activityModel}
