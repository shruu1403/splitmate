const express = require("express");
const http = require("http");
require("dotenv").config();
const PORT = process.env.PORT;
const cors = require("cors");
const passport = require("passport");

const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.routes");
const { authRouter } = require("./routes/auth.routes");
const { groupRouter } = require("./routes/group.routes");
const { expenseRouter } = require("./routes/expense.routes");
const { settlementRouter } = require("./routes/settlement.routes");
const { notificationRouter } = require("./routes/notification.routes");
const { balanceRouter } = require("./routes/balance.routes");
const { activityRouter } = require("./routes/activity.routes");
const { inviteRouter } = require("./routes/invite.routes");
const { friendRouter } = require("./routes/friends.routes");

const app = express();
const server = http.createServer(app)

//setup socket.io
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: [
      "https://www.splitmate.me"
    ],
    credentials: true,
  },
})
//middleware
app.use(
  cors({
    origin: [
      "https://www.splitmate.me"
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(passport.initialize());
require("./config/passport");

app.use("/api/users", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/groups", groupRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/settlement", settlementRouter);
app.use("/api/notification", notificationRouter);
app.use("/api/balance", balanceRouter);
app.use("/api/activity", activityRouter);
app.use("/api/invite", inviteRouter);
app.use("/api/friend", friendRouter)

app.get("/", (req, res) => {
  res.send("SplitMate API running");
});

//socket.io connection
io.on("connection", (socket) => {
  console.log("user connected:", socket.id);

  socket.on("join_group", (groupId) => {
    socket.join(groupId)
    console.log(`user ${socket.id} joined group ${groupId}`);
  })
  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
  })

})

server.listen(PORT, async () => {
  try {
    await connection;
    console.log(`server running on port ${PORT} and db is also connected`);
  } catch (error) {
    console.log(error);
  }
});
module.exports = { io }