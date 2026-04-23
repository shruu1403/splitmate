const express = require("express");
const passport = require("passport");
const { getFrontendUrl, isAllowedClientUrl } = require("../config/urls");

const authRouter = express.Router();

//initiate google login
authRouter.get(
  "/google",
  (req, res, next) => {
    const requestedOrigin = req.query.origin;
    const state = isAllowedClientUrl(requestedOrigin)
      ? encodeURIComponent(requestedOrigin)
      : undefined;

    passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  }
);

//callbackURL
authRouter.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const { token } = req.user;
    const stateOrigin = req.query.state
      ? decodeURIComponent(req.query.state)
      : "";
    const frontendUrl = isAllowedClientUrl(stateOrigin)
      ? stateOrigin
      : getFrontendUrl();
    const html = `
      <html>
        <body>
          <script>
            // Send token to opener window
            window.opener.postMessage({ token: "${token}" },
            "${frontendUrl}");

            window.close();
          </script>
          <p>Logging you in...</p>
        </body>
      </html>
    `;

    res.send(html);
  }
);

module.exports = { authRouter };
