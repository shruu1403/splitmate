const mongoose = require("mongoose")

const groupSchema=mongoose.Schema(
    {
        name:{
            type:String,
            required:true,
            trim:true,   //trim is for removing trail spaces
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref:"user",
            },
        ],
        createdBy:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"user",
            required:true,
        },
        description:{
            type:String,
            trim:true,
        },
    },
    { timestamps : true}   //timestamps are for two auto add fields : craetedAt , updatedAt
)
const groupModel = mongoose.model("group",groupSchema)
module.exports = {groupModel}