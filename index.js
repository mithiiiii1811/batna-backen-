const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://YOUR_VERCEL_APP.vercel.app" // ⚠️ thay YOUR_VERCEL_APP bằng tên app thật của bạn
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.send("ok"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const waitingByGroup = new Map();

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join-group", ({ groupId }) => {
    if (!groupId) return;

    if (waitingByGroup.has(groupId)) {
      const otherId = waitingByGroup.get(groupId);
      waitingByGroup.delete(groupId);

      const room = `room:${groupId}:${otherId}:${socket.id}`;
      socket.join(room);
      const otherSocket = io.sockets.sockets.get(otherId);
      if (otherSocket) otherSocket.join(room);

      io.to(room).emit("matched", {
        room,
        groupId,
        players: [otherId, socket.id]
      });
      console.log(`[MATCHED] group ${groupId}:`, otherId, socket.id);
    } else {
      waitingByGroup.set(groupId, socket.id);
      socket.emit("waiting", { groupId });
      console.log(`[WAITING] ${socket.id} waiting in group ${groupId}`);
    }

    socket.on("disconnect", () => {
      if (waitingByGroup.get(groupId) === socket.id) {
        waitingByGroup.delete(groupId);
        console.log(`[CLEANUP] removed waiting in group ${groupId}`);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log("Server listening on", PORT);
});
