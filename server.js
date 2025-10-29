const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from "public"
app.use(express.static(path.join(__dirname, "public")));

// Handle socket connections
io.on("connection", (socket) => {
  console.log("A user connected");

  // Listen for chat messages
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg); // broadcast to all
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
