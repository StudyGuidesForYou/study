const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Make sure this matches your frontend dev URL
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  let displayName = "Anonymous";

  socket.on('setDisplayName', (name) => {
    displayName = name || "Anonymous";
  });

  socket.on('message', (msg) => {
    io.emit('message', {
      text: msg,
      sender: displayName,
      timestamp: new Date(),
    });
  });
});

server.listen(5000, () => {
  console.log('Server listening on port 5000');
});
