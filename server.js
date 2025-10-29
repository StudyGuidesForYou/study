const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// ===== SQLite Setup =====
const db = new sqlite3.Database("./db/chat.db");

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ===== Middleware =====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== Routes =====

// Register new user
app.post("/register", async (req, res) => {
  const { username, password, email } = req.body;
  if(!username || !password) return res.status(400).send("Username and password required");

  const hashed = await bcrypt.hash(password, 10);
  db.run(
    `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
    [username, hashed, email],
    function(err) {
      if(err) return res.status(400).send("Username already exists");
      res.send("User registered successfully");
    }
  );
});

// Login user
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
    if(!row) return res.status(400).send("Invalid username or password");
    const match = await bcrypt.compare(password, row.password);
    if(match) res.send("Login successful");
    else res.status(400).send("Invalid username or password");
  });
});

// Get last 500 messages
app.get("/messages", (req, res) => {
  db.all(`SELECT * FROM messages ORDER BY id ASC LIMIT 500`, [], (err, rows) => {
    res.json(rows);
  });
});

// ===== Socket.IO =====
io.on("connection", (socket) => {
  console.log("User connected");

  // Broadcast messages
  socket.on("chat message", (data) => {
    const { username, message } = data;
    // Save to DB
    db.run(`INSERT INTO messages (username, message) VALUES (?, ?)`, [username, message]);
    io.emit("chat message", { username, message });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ===== Start Server =====
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
