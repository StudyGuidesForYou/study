// ------------- CONFIG -------------
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

// create Supabase client - use a distinct variable name
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------- DOM ELEMENTS -------------
let loginForm, registerForm, toggleBtn, authTitle, authMsgEl;
let authCard, chatCard, currentUserEl, messagesEl, messageForm, messageInput, logoutBtn;

// wait for DOM load
window.addEventListener('DOMContentLoaded', () => {
  // auth
  loginForm = document.getElementById('login-form');
  registerForm = document.getElementById('register-form');
  toggleBtn = document.getElementById('toggle-btn');
  authTitle = document.getElementById('auth-title');
  authMsgEl = document.getElementById('auth-msg');
  authCard = document.getElementById('auth-card');

  // chat
  chatCard = document.getElementById('chat-card');
  currentUserEl = document.getElementById('current-user');
  messagesEl = document.getElementById('messages');
  messageForm = document.getElementById('message-form');
  messageInput = document.getElementById('message-input');
  logoutBtn = document.getElementById('logout-btn');

  // wire events
  toggleBtn.addEventListener('click', toggleAuthForms);
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  messageForm.addEventListener('submit', handleSendMessage);
  logoutBtn.addEventListener('click', handleLogout);

  // try existing session
  const saved = localStorage.getItem('currentUser');
  if (saved) {
    showChat(saved);
  } else {
    showAuth();
  }
});

// ----------------- Helpers -----------------
// show messages in status area
function showAuthMsg(text, ok = false) {
  authMsgEl.textContent = text || '';
  authMsgEl.classList.toggle('success', ok);
}

// safe append message UI
function appendMessageToUI(user, text) {
  const div = document.createElement('div');
  div.className = 'message';
  const safeUser = (user === null || user === undefined) ? 'Anon' : escapeHtml(user);
  div.innerHTML = `<strong>${safeUser}:</strong> ${escapeHtml(text)}`;
  messagesEl.appendChild(div);
  // scroll
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
}

// SHA-256 helper (Web Crypto) returns hex
async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ----------------- Auth UI -----------------
function toggleAuthForms() {
  const loginHidden = loginForm.classList.contains('hidden');
  if (loginHidden) {
    // show login
    authTitle.textContent = 'Login';
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    toggleBtn.textContent = 'Register';
    showAuthMsg('');
  } else {
    // show register
    authTitle.textContent = 'Register';
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    toggleBtn.textContent = 'Log in';
    showAuthMsg('');
  }
}

function showAuth() {
  authCard.classList.remove('hidden');
  chatCard.classList.add('hidden');
  showAuthMsg('');
}

function showChat(username) {
  authCard.classList.add('hidden');
  chatCard.classList.remove('hidden');
  currentUserEl.textContent = username;
  showAuthMsg('');
  // load messages and subscribe
  loadRecentMessages();
  subscribeToNewMessages();
}

// ----------------- Auth handlers -----------------
async function handleRegister(e) {
  e.preventDefault();
  showAuthMsg('Registering...');

  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;

  if (!username || !password) {
    showAuthMsg('Username and password required');
    return;
  }

  try {
    // check if username exists
    const { data: existing, error: selErr } = await sb.from('users').select('id').eq('username', username).limit(1).maybeSingle();
    if (selErr) {
      console.error('select err', selErr);
      showAuthMsg('Error checking username');
      return;
    }
    if (existing) {
      showAuthMsg('Username already taken');
      return;
    }

    const password_hash = await sha256hex(username + '|' + password);
    const { error } = await sb.from('users').insert([{ username, password_hash }]);
    if (error) {
      console.error('insert err', error);
      showAuthMsg('Registration failed: ' + error.message);
      return;
    }

    showAuthMsg('Registered! Please log in.', true);
    // switch to login
    toggleAuthForms();
  } catch (err) {
    console.error(err);
    showAuthMsg('Registration error');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  showAuthMsg('Logging in...');

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showAuthMsg('Username and password required');
    return;
  }

  try {
    const { data, error } = await sb.from('users').select('password_hash').eq('username', username).maybeSingle();
    if (error) {
      console.error('select err', error);
      showAuthMsg('Login failed (DB error)');
      return;
    }
    if (!data) {
      showAuthMsg('User not found');
      return;
    }

    const password_hash = await sha256hex(username + '|' + password);
    if (password_hash !== data.password_hash) {
      showAuthMsg('Incorrect password');
      return;
    }

    // success
    localStorage.setItem('currentUser', username);
    showAuthMsg('Logged in', true);
    showChat(username);
  } catch (err) {
    console.error(err);
    showAuthMsg('Login error');
  }
}

async function handleLogout(e) {
  e?.preventDefault();
  localStorage.removeItem('currentUser');
  // unsubscribe channel if needed
  try {
    // best-effort unsubscribe
    if (window._supabase_subscription) {
      await sb.removeChannel(window._supabase_subscription);
      window._supabase_subscription = null;
    }
  } catch (err) {
    console.warn('unsubscribe fail', err);
  }
  showAuth();
}

// ----------------- Messages -----------------
async function loadRecentMessages() {
  messagesEl.innerHTML = '';
  try {
    // try selecting both possible columns names
    const { data, error } = await sb
      .from('messages')
      .select('username, message, content, created_at')
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      console.error('load messages error', error);
      document.getElementById('chat-status').textContent = 'Failed to load messages';
      return;
    }
    if (!data) return;

    data.forEach(row => {
      const user = row.username || row.email || 'Anon';
      const text = row.message ?? row.content ?? '';
      appendMessageToUI(user, text);
    });
  } catch (err) {
    console.error(err);
    document.getElementById('chat-status').textContent = 'Error loading messages';
  }
}

async function handleSendMessage(e) {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if (!txt) return;
  const username = localStorage.getItem('currentUser') || 'Anon';

  try {
    // insert into 'message' column if that exists on your table, otherwise 'content'
    // We'll insert into both to be safe; one will be null in DB, but that's okay.
    const payload = { username, message: txt };
    const { error } = await sb.from('messages').insert([payload]);
    if (error) {
      console.error('insert msg err', error);
      document.getElementById('chat-status').textContent = 'Failed to send message';
      return;
    }
    messageInput.value = '';
    document.getElementById('chat-status').textContent = '';
  } catch (err) {
    console.error(err);
    document.getElementById('chat-status').textContent = 'Send error';
  }
}

// ----------------- Realtime -----------------
function subscribeToNewMessages() {
  // remove existing subscription if any
  if (window._supabase_subscription) {
    try { sb.removeChannel(window._supabase_subscription); } catch(_) {}
    window._supabase_subscription = null;
  }

  const channel = sb.channel('public:messages');

  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
    // payload.new may have message or content field
    const user = payload.new.username || payload.new.email || 'Anon';
    const text = payload.new.message ?? payload.new.content ?? '';
    appendMessageToUI(user, text);
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed to realtime messages');
    }
  });

  window._supabase_subscription = channel;
}
