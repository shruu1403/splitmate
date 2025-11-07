const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { userModel } = require("../models/userModel");
const jwt = require("jsonwebtoken");

require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // callbackURL: "http://localhost:8080/api/auth/google/callback",
      callbackURL: "https://splitmate-32de.onrender.com/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;

        let user = await userModel.findOne({ email });

        if (!user) {
          user = new userModel({
            name,
            email,
            password: "google-oauth",
          });
          await user.save();
        }

        //generete JWT
        const token = jwt.sign(
          { userID: user._id, name: user.name, email: user.email }, // ✅ same as normal login
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        //attach token and user to request
        return done(null, { token, name: user.name });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);
