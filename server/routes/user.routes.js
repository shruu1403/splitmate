const express = require("express")
const {userModel} =require("../models/userModel")
const {blacklistModel} =require("../models/blacklistModel")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
require ("dotenv").config()

const userRouter = express.Router()

userRouter.post("/register", async(req,res)=>{
    const {email , password , name} =req.body
    try {
        const userexists = await userModel.findOne({email})
        if(userexists){
            res.status(400).send({msg:"user exists already"})
        }else{
            bcrypt.hash(password , 5, async(err,hash)=>{
                if(err){
                    res.status(400).send({msg:"error while hashing the password"})
                }else{
                    const user= new userModel({email , name , password:hash})
                    await user.save()
                    res.status(200).send({msg:"user has been registered successfully", registeredUser: user})
                }
            })
        }
    } catch (error) {
        res.status(500).send({msg:"registration failed", error:error.message})
    }
})

userRouter.post("/login", async(req,res)=>{
    const {email , password} =req.body
    try {
        const user= await userModel.findOne({email})
        if(user){
            bcrypt.compare(password , user.password , (err,decoded)=>{
                if(decoded){
                    const token =jwt.sign({userID: user._id , name:user.name, email:user.email},process.env.JWT_SECRET,{expiresIn:"7d"})
                    res.status(200).send({msg:"login successful" , token:token , name:user.name})
                }else{
                    res.status(400).send({msg:"wrong password"})
                }
            })
        }else{
            res.status(404).send({msg:"user not found"})
        }
    } catch (error) {
        res.status(500).send({msg:"login failed", error:error.message})
    }

})

userRouter.get("/logout" , async(req,res)=>{
    const token = req.headers.authorization?.split(" ")[1]
    try {
        if(token){
            const blacklisted = new blacklistModel({token})
            await blacklisted.save()
            res.status(200).send({msg:"logout successful"})
        }else{
            res.status(400).send({msg:"token missing"})
        }
    } catch (error) {
        res.status(500).send({msg:"logout failed", error:error.message})
    }

})

module.exports = {userRouter}