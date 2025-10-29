// server.js - Express + Socket.IO + LowDB (JSON file storage)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const DB_PATH = path.join(__dirname, 'db.json');

// LowDB setup
const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter);

async function initDb() {
  await db.read();
  db.data = db.data || { users: {}, usernames: {}, nextGuest: 1, chat: [] };
  await db.write();
}
initDb();

// Express setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT helpers
function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch(e) { return null; }
}
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid Authorization' });
  const payload = verifyToken(parts[1]);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  await db.read();
  const user = db.data.users[payload.id];
  if (!user) return res.status(401).json({ error: 'Invalid user' });
  req.user = user;
  next();
}

// --- API Endpoints ---

// Signup
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  await db.read();
  if (db.data.usernames[username]) return res.status(409).json({ error: 'Username taken' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id, username, passwordHash, data: {}, createdAt: Date.now() };

  db.data.users[id] = user;
  db.data.usernames[username] = id;
  await db.write();

  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, data: user.data } });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  await db.read();
  const id = db.data.usernames[username];
  if (!id) return res.status(401).json({ error: 'Invalid credentials' });

  const user = db.data.users[id];
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });

  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, data: user.data } });
});

// Get current user
app.get('/api/me', authMiddleware, async (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, data: req.user.data });
});

// Save game data (protected)
app.post('/api/save-game', authMiddleware, async (req, res) => {
  const { gameId, payload } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'Missing gameId' });

  await db.read();
  db.data.users[req.user.id].data = db.data.users[req.user.id].data || {};
  db.data.users[req.user.id].data[gameId] = payload;
  await db.write();
  res.json({ ok: true });
});

// Chat history (last 200)
app.get('/api/chat-history', async (req, res) => {
  await db.read();
  const slice = db.data.chat.slice(-200);
  res.json({ chat: slice });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --- Start HTTP + Socket.IO ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

io.use(async (socket, next) => {
  // Token can be in handshake auth
  const token = socket.handshake.auth?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      await db.read();
      const user = db.data.users[payload.id];
      if (user) {
        socket.data.user = { id: user.id, username: user.username, logged: true };
        return next();
      }
    }
  }
  // Allow guests if no valid token
  await db.read();
  const guestNum = db.data.nextGuest++;
  const guest = { id: `guest_${guestNum}`, username: `User_${guestNum}`, logged: false };
  db.data.nextGuest = db.data.nextGuest;
  await db.write();
  socket.data.user = guest;
  next();
});

io.on('connection', async (socket) => {
  const user = socket.data.user;
  io.emit('user-joined', { id: user.id, username: user.username });
  // Send chat history
  await db.read();
  socket.emit('chat-history', db.data.chat.slice(-200));

  socket.on('chat-message', async (payload) => {
    const text = String(payload?.text || '').trim();
    if (!text) return;
    const msg = { id: uuidv4(), userId: user.id, username: user.username, text, ts: Date.now() };
    await db.read();
    db.data.chat.push(msg);
    if (db.data.chat.length > 1000) db.data.chat.splice(0, db.data.chat.length - 1000);
    await db.write();
    io.emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    io.emit('user-left', { id: user.id, username: user.username });
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
