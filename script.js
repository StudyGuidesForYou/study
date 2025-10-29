// ---------------- CONFIG ----------------
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- DOM ----------------
const nameModal = document.getElementById("name-modal");
const displayNameInput = document.getElementById("display-name");
const enterBtn = document.getElementById("enter-chat");
const rememberChk = document.getElementById("remember-name");

const app = document.getElementById("app");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");
const themeToggle = document.getElementById("theme-toggle");
const leaveBtn = document.getElementById("leave-btn");
const myNameEl = document.getElementById("my-name");
const myAvatarEl = document.getElementById("my-avatar");
const clearLocalBtn = document.getElementById("clear-local");
const typingTable = 'typing_presence'; // table name in Supabase for presence
const profanity = ["badword1","badword2","poop"]; // simple list, edit as desired

// small helper: get/set display name locally
function saveDisplayName(name, remember) {
  if (remember) localStorage.setItem("displayName", name);
  sessionStorage.setItem("displayName", name);
}
function clearDisplayNameLocal() {
  localStorage.removeItem("displayName");
  sessionStorage.removeItem("displayName");
}
function getSavedDisplayName() {
  return sessionStorage.getItem("displayName") || localStorage.getItem("displayName");
}

// set avatar color and initial
function avatarFor(name, el) {
  const initials = (name || "??").slice(0,2).toUpperCase();
  el.textContent = initials;
  // color by hash
  let h = 0; for (let i=0;i<name.length;i++) h = (h<<5)-h + name.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  el.style.background = `linear-gradient(135deg, hsl(${hue} 80% 50%), hsl(${(hue+60)%360} 80% 40%))`;
}

// profanity filter (obfuscate)
function sanitizeMessage(s) {
  let out = s;
  profanity.forEach(w => {
    const re = new RegExp('\\b' + w.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&') + '\\b', 'ig');
    out = out.replace(re, (m) => '*'.repeat(m.length));
  });
  return out;
}

// scroll helper
function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ---------------- Display logic ----------------
function showAppFor(name) {
  nameModal.style.display = "none";
  app.classList.remove("hidden");
  myNameEl.textContent = name;
  avatarFor(name, myAvatarEl);
  // init chat
  loadMessages();
  subscribeMessages();
  startTypingHeartbeat();
}
function showNameModal() {
  nameModal.style.display = "";
  app.classList.add("hidden");
}

// ---------------- Enter chat ----------------
enterBtn.addEventListener('click', () => {
  const name = displayNameInput.value.trim();
  if (!name) return alert("Please enter a display name");
  const remember = rememberChk.checked;
  saveDisplayName(name, remember);
  showAppFor(name);
});

// auto-open if saved
const saved = getSavedDisplayName();
if (saved) {
  displayNameInput.value = saved;
  saveDisplayName(saved, true);
  showAppFor(saved);
} else {
  showNameModal();
}

// ---------------- Theme toggle ----------------
themeToggle?.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// ---------------- Messages load & render ----------------
let myDisplayName = () => sessionStorage.getItem("displayName") || localStorage.getItem("displayName") || "Anon";

async function loadMessages() {
  messagesEl.innerHTML = '';
  try {
    const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: true }).limit(500);
    if (error) { console.error(error); return; }
    data.forEach(row => renderMessageRow(row));
    scrollBottom();
  } catch (err) { console.error(err); }
}

function renderMessageRow(row) {
  const id = row.id;
  const username = row.username || "Anon";
  const text = sanitizeMessage(row.message ?? row.content ?? '');
  const el = document.createElement('li');
  el.className = 'message' + (username === myDisplayName() ? ' me' : '');
  el.dataset.id = id;
  el.innerHTML = `
    <div class="avatar" title="${escapeHtml(username)}">${escapeHtml((username||'').slice(0,2).toUpperCase())}</div>
    <div style="flex:1">
      <div class="meta"><strong>${escapeHtml(username)}</strong> <span class="muted">· ${new Date(row.created_at).toLocaleTimeString()}</span></div>
      <div class="text">${escapeHtml(text)}</div>
    </div>
    <div class="msg-actions">
      <button data-action="react">❤️</button>
      ${username === myDisplayName() ? `<button data-action="delete">Delete</button>` : `<button data-action="report">Report</button>`}
    </div>
  `;
  // attach actions
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => handleMessageAction(e, row));
  });
  messagesEl.appendChild(el);
}

// escape
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
}

// ---------------- Message actions ----------------
async function handleMessageAction(e, row) {
  const action = e.currentTarget.dataset.action;
  if (action === 'delete') {
    if (row.username !== myDisplayName()) return alert("You can only delete your own messages");
    if (!confirm("Delete this message?")) return;
    const { error } = await sb.from('messages').delete().eq('id', row.id);
    if (error) return alert("Delete failed: " + error.message);
    // remove from UI
    const el = messagesEl.querySelector(`li[data-id="${row.id}"]`);
    if (el) el.remove();
  } else if (action === 'report') {
    const reason = prompt("Report reason (optional):", "spam");
    await sb.from('reports').insert([{ message_id: row.id, reporter: myDisplayName(), reason: reason || null }]);
    alert("Reported — moderators will review.");
  } else if (action === 'react') {
    // simple local animation
    e.currentTarget.classList.add('pulse');
    setTimeout(()=>e.currentTarget.classList.remove('pulse'),800);
  }
}

// ---------------- Send message ----------------
messageForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const text0 = messageInput.value.trim();
  if (!text0) return;
  const text = sanitizeMessage(text0).slice(0,1000);
  const username = myDisplayName();
  // insert
  const { error } = await sb.from('messages').insert([{ username, message: text }]);
  if (error) {
    console.error('send error', error);
    return;
  }
  messageInput.value = '';
});

// ---------------- Realtime subscription ----------------
let channel = null;
function subscribeMessages() {
  if (channel) try { sb.removeChannel(channel); } catch(_) {}
  channel = sb.channel('public:messages');

  channel.on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
    renderMessageRow(payload.new);
    scrollBottom();
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.log('Subscribed to messages');
  });

  window._chat_channel = channel;
}

// ---------------- Typing indicator (presence)
let typingTimer = null;
function startTypingHeartbeat() {
  // update typing_presence row every 2s while typing
  messageInput.addEventListener('input', () => {
    sendTypingHeartbeat();
  });

  // subscribe to typing_presence
  const tp = sb.channel('public:typing_presence');
  tp.on('postgres_changes', { event: '*', schema: 'public', table: 'typing_presence' }, payload => {
    // query presence rows and show who typed recently
    showTypingUsers();
  });
  tp.subscribe();
  window._typing_channel = tp;
}

let lastTypingSent = 0;
async function sendTypingHeartbeat() {
  const now = Date.now();
  if (now - lastTypingSent < 1200) return;
  lastTypingSent = now;
  const name = myDisplayName();
  try {
    await sb.from('typing_presence').upsert([{ username: name, last_seen: new Date().toISOString() }], { onConflict: 'username' });
    // cleanup old rows periodically
    await sb.rpc('cleanup_typing_presence', {});
  } catch (err) {
    // ignore
  }
}

async function showTypingUsers() {
  try {
    const cutoff = new Date(Date.now() - 5000).toISOString();
    const { data } = await sb.from('typing_presence').select('*').gt('last_seen', cutoff);
    const others = (data || []).filter(r => r.username !== myDisplayName()).map(r => r.username);
    typingIndicator.textContent = others.length ? `${others.join(', ')} typing…` : '';
  } catch (err) {
    console.error(err);
  }
}

// ---------------- Utility buttons ----------------
themeToggle?.addEventListener('click', () => document.body.classList.toggle('light'));
leaveBtn?.addEventListener('click', () => {
  clearDisplayNameLocal();
  window.location.reload();
});
clearLocalBtn?.addEventListener('click', () => {
  clearDisplayNameLocal();
  alert('Local display name cleared. You will be asked for a name next time.');
});

// ---------------- Helper: cleanup function on server (optional)
// If you want, create a Postgres function named cleanup_typing_presence to delete old rows.
// If not present, the call will fail silently.
