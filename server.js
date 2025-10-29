// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const PORT = process.env.PORT || 3000;

// --- Load / Save DB ---
function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const base = {
      users: {},
      usernames: {},
      nextGuest: 1,
      chat: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(base, null, 2));
    return base;
  }
  return JSON.parse(fs.readFileSync(DB_PATH));
}
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
let db = loadDb();

// --- Express ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- JWT Helpers ---
function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid Authorization' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users[payload.id];
    if (!user) return res.status(401).json({ error: 'Invalid user' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- API Endpoints ---

// Sign Up
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  if (db.usernames[username]) return res.status(409).json({ error: 'Username taken' });
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id, username, passwordHash, data: {}, createdAt: Date.now() };
  db.users[id] = user;
  db.usernames[username] = id;
  saveDb(db);
  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, data: user.data } });
});

// Log In
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  const id = db.usernames[username];
  if (!id) return res.status(401).json({ error: 'Invalid credentials' });
  const user = db.users[id];
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, data: user.data } });
});

// Get current user
app.get('/api/me', authMiddleware, (req, res) => {
  const user = req.user;
  res.json({ id: user.id, username: user.username, data: user.data });
});

// Save game data
app.post('/api/save-game', authMiddleware, (req, res) => {
  const { gameId, payload } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'Missing gameId' });
  const user = req.user;
  user.data[gameId] = payload;
  db.users[user.id] = user;
  saveDb(db);
  res.json({ ok: true });
});

// Chat history
app.get('/api/chat-history', (req, res) => {
  res.json({ chat: db.chat.slice(-200) });
});

// --- HTTP + Socket.IO ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Socket auth
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } 
  catch { return null; }
}

io.on('connection', (socket) => {
  let token = socket.handshake.auth && socket.handshake.auth.token;
  let user = null;
  if (token) {
    const payload = verifyToken(token);
    if (payload && db.users[payload.id]) {
      user = { id: payload.id, username: payload.username, logged: true };
    }
  }
  if (!user) {
    const guestNumber = db.nextGuest++;
    user = { id: `guest_${guestNumber}`, username: `User_${guestNumber}`, logged: false };
    saveDb(db);
  }

  socket.data.user = user;
  io.emit('user-joined', { id: user.id, username: user.username });
  socket.emit('chat-history', db.chat.slice(-200));

  socket.on('chat-message', (payload) => {
    const text = String(payload && payload.text || '').trim();
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
    io.emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    io.emit('user-left', { id: user.id, username: user.username });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
