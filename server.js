// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const DB_FILE = path.join(__dirname, 'db.sqlite');

// --- Initialize SQLite ---
const db = new Database(DB_FILE);

// Create tables if missing
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  passwordHash TEXT,
  data TEXT,
  createdAt INTEGER
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS chat (
  id TEXT PRIMARY KEY,
  userId TEXT,
  username TEXT,
  text TEXT,
  ts INTEGER
);
`);

// Ensure nextGuest exists
const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
if (!getMeta.get('nextGuest')) {
  setMeta.run('nextGuest', '1');
}

// --- Helper functions ---
function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch (e) { return null; }
}

// Users
const insertUserStmt = db.prepare('INSERT INTO users (id, username, passwordHash, data, createdAt) VALUES (@id,@username,@passwordHash,@data,@createdAt)');
const getUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const updateUserData = db.prepare('UPDATE users SET data = ? WHERE id = ?');

// Chat
const insertChatStmt = db.prepare('INSERT INTO chat (id, userId, username, text, ts) VALUES (@id,@userId,@username,@text,@ts)');
const getLastChat = db.prepare('SELECT * FROM chat ORDER BY ts DESC LIMIT ?');

// Meta operations
function nextGuestId() {
  const row = getMeta.get('nextGuest');
  let n = row ? parseInt(row.value, 10) : 1;
  const next = n + 1;
  setMeta.run('nextGuest', String(next));
  return n;
}

// --- Express setup ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// Signup
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const existing = getUserByUsername.get(username);
  if (existing) return res.status(409).json({ error: 'Username taken' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  const userObj = { id, username, passwordHash, data: JSON.stringify({}), createdAt: now };

  try {
    insertUserStmt.run(userObj);
    const token = createToken({ id, username });
    return res.json({ token, user: { id, username, data: {} } });
  } catch (e) {
    console.error('signup error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const row = getUserByUsername.get(username);
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, row.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });

  const token = createToken({ id: row.id, username: row.username });
  const data = row.data ? JSON.parse(row.data) : {};
  return res.json({ token, user: { id: row.id, username: row.username, data } });
});

// Get current user
app.get('/api/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid Authorization' });
  const payload = verifyToken(parts[1]);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });

  const row = getUserById.get(payload.id);
  if (!row) return res.status(401).json({ error: 'Invalid user' });
  const data = row.data ? JSON.parse(row.data) : {};
  res.json({ id: row.id, username: row.username, data });
});

// Save game data
app.post('/api/save-game', (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid Authorization' });
  const payload = verifyToken(parts[1]);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });

  const { gameId, payload: gamePayload } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'Missing gameId' });

  const row = getUserById.get(payload.id);
  if (!row) return res.status(401).json({ error: 'Invalid user' });

  const data = row.data ? JSON.parse(row.data) : {};
  data[gameId] = gamePayload;
  updateUserData.run(JSON.stringify(data), row.id);
  return res.json({ ok: true });
});

// Chat history
app.get('/api/chat-history', (req, res) => {
  const rows = getLastChat.all(200).reverse();
  res.json({ chat: rows });
});

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --- Start HTTP + Socket.IO ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// Socket auth + guest creation
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const row = getUserById.get(payload.id);
      if (row) {
        socket.data.user = { id: row.id, username: row.username, logged: true };
        return next();
      }
    }
  }
  // create guest
  const n = nextGuestId();
  const guest = { id: `guest_${n}`, username: `User_${n}`, logged: false };
  socket.data.user = guest;
  return next();
});

// socket handlers
io.on('connection', (socket) => {
  const user = socket.data.user;
  io.emit('user-joined', { id: user.id, username: user.username });

  // send chat history
  const rows = getLastChat.all(200).reverse();
  socket.emit('chat-history', rows);

  socket.on('chat-message', (payload) => {
    const text = String(payload?.text || '').trim();
    if (!text) return;
    const msg = { id: uuidv4(), userId: user.id, username: user.username, text, ts: Date.now() };
    try {
      insertChatStmt.run(msg);
      // trim to last 1000 on write (simple approach)
      const total = db.prepare('SELECT COUNT(*) as c FROM chat').get().c;
      if (total > 1000) {
        // delete oldest rows beyond 1000
        db.prepare('DELETE FROM chat WHERE id IN (SELECT id FROM chat ORDER BY ts ASC LIMIT ?)').run(total - 1000);
      }
      io.emit('chat-message', msg);
    } catch (e) {
      console.error('chat insert error', e);
    }
  });

  socket.on('disconnect', () => {
    io.emit('user-left', { id: user.id, username: user.username });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
