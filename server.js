// server.js
//----------------------------------------------------
// ✅ Imports
//----------------------------------------------------
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

//----------------------------------------------------
// ✅ Paths & Config
//----------------------------------------------------
const DB_PATH = path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const PORT = process.env.PORT || 3000;   // ✅ Works locally + Render

//----------------------------------------------------
// ✅ Load/Save JSON DB
//----------------------------------------------------
function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const fresh = { users: {}, usernames: {}, nextGuest: 1, chat: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDb();

//----------------------------------------------------
// ✅ Express Setup
//----------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve /public folder for your frontend
app.use(express.static(path.join(__dirname, 'public')));

//----------------------------------------------------
// ✅ JWT Helpers
//----------------------------------------------------
function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing Authorization" });

  const parts = header.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "Invalid Authorization" });

  try {
    const data = jwt.verify(parts[1], JWT_SECRET);
    const user = db.users[data.id];
    if (!user) return res.status(401).json({ error: "Invalid user" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

//----------------------------------------------------
// ✅ API: SIGNUP
//----------------------------------------------------
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password)
    return res.status(400).json({ error: "Missing username or password" });

  if (db.usernames[username])
    return res.status(409).json({ error: "Username already taken" });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  const user = { id, username, passwordHash, data: {}, createdAt: Date.now() };

  db.users[id] = user;
  db.usernames[username] = id;
  saveDb(db);

  res.json({ 
    token: createToken(user), 
    user: { id: user.id, username: user.username, data: user.data }
  });
});

//----------------------------------------------------
// ✅ API: LOGIN
//----------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password)
    return res.status(400).json({ error: "Missing username or password" });

  const id = db.usernames[username];
  if (!id) return res.status(401).json({ error: "Invalid credentials" });

  const user = db.users[id];

  if (!bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: "Invalid credentials" });

  res.json({
    token: createToken(user),
    user: { id: user.id, username: user.username, data: user.data }
  });
});

//----------------------------------------------------
// ✅ API: GET CURRENT USER
//----------------------------------------------------
app.get('/api/me', authMiddleware, (req, res) => {
  const u = req.user;
  res.json({ id: u.id, username: u.username, data: u.data });
});

//----------------------------------------------------
// ✅ API: SAVE GAME DATA
//----------------------------------------------------
app.post('/api/save-game', authMiddleware, (req, res) => {
  const { gameId, payload } = req.body || {};

  if (!gameId)
    return res.status(400).json({ error: "Missing gameId" });

  req.user.data[gameId] = payload;
  db.users[req.user.id] = req.user;
  saveDb(db);

  res.json({ ok: true });
});

//----------------------------------------------------
// ✅ API: CHAT HISTORY
//----------------------------------------------------
app.get('/api/chat-history', (_, res) => {
  res.json({ chat: db.chat.slice(-200) });
});

//----------------------------------------------------
// ✅ HTTP + SOCKET.IO Server
//----------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ✅ Token verifier for sockets
function verifySocketToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

//----------------------------------------------------
// ✅ SOCKET.IO CONNECTION
//----------------------------------------------------
io.on('connection', (socket) => {
  let token = socket.handshake.auth?.token;
  let user = null;

  // ✅ Logged in user
  if (token) {
    const payload = verifySocketToken(token);
    if (payload && db.users[payload.id]) {
      user = { 
        id: payload.id, 
        username: payload.username, 
        logged: true 
      };
    }
  }

  // ✅ Guest user
  if (!user) {
    const guestNum = db.nextGuest++;
    user = { 
      id: `guest_${guestNum}`, 
      username: `User_${guestNum}`, 
      logged: false 
    };
    saveDb(db);
  }

  //------------------------------------------------
  // ✅ Store on socket
  //------------------------------------------------
  socket.data.user = user;

  //------------------------------------------------
  // ✅ Tell everyone a user joined
  //------------------------------------------------
  io.emit("user-joined", { id: user.id, username: user.username });

  //------------------------------------------------
  // ✅ Send chat history to this user
  //------------------------------------------------
  socket.emit("chat-history", db.chat.slice(-200));

  //------------------------------------------------
  // ✅ New Chat Message
  //------------------------------------------------
  socket.on("chat-message", (payload) => {
    const text = String(payload?.text || "").trim();
    if (!text) return;

    const msg = {
      id: uuidv4(),
      userId: user.id,
      username: user.username,
      text,
      ts: Date.now()
    };

    db.chat.push(msg);
    if (db.chat.length > 1000) db.chat.splice(0, db.chat.length - 1000);

    saveDb(db);
    io.emit("chat-message", msg);
  });

  //------------------------------------------------
  // ✅ Disconnect
  //------------------------------------------------
  socket.on("disconnect", () => {
    io.emit("user-left", { id: user.id, username: user.username });
  });
});

//----------------------------------------------------
// ✅ Start server (Render overrides PORT automatically)
//----------------------------------------------------
server.listen(PORT, () => {
  console.log(`✅ Server running on PORT ${PORT}`);
});
