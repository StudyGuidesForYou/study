// ===== Supabase Setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== DOM Elements =====
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const authTitle = document.getElementById('auth-title');
const toggleAuth = document.getElementById('toggle-auth');

const chatContainer = document.getElementById('chat-container');
const authContainer = document.getElementById('auth-container');
const currentUserSpan = document.getElementById('current-user');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');

// ===== Helper: SHA-256 hashing =====
async function hashString(str) {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}

// ===== Toggle Login/Register Forms =====
showRegister.addEventListener('click', (e) => {
  e.preventDefault();
  if (loginForm.style.display !== 'none') {
    // show register
    authTitle.textContent = 'Register';
    loginForm.style.display = 'none';
    registerForm.style.display = '';
    toggleAuth.innerHTML = "Already have an account? <a href='#' id='show-login'>Log In</a>";
    document.getElementById('show-login').onclick = showRegister;
  } else {
    // show login
    authTitle.textContent = 'Login';
    loginForm.style.display = '';
    registerForm.style.display = 'none';
    toggleAuth.innerHTML = "Don't have an account? <a href='#' id='show-register'>Register</a>";
    document.getElementById('show-register').onclick = showRegister;
  }
});

// ===== Registration =====
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const password_hash = await hashString(username + password);

  const { error } = await supabase.from('users').insert([{ username, password_hash }]);
  if (error) alert('Registration error: ' + error.message);
  else {
    alert('Registered successfully! Please log in.');
    showRegister(); // switch to login
  }
});

// ===== Login =====
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const { data, error } = await supabase.from('users').select('password_hash').eq('username', username).single();
  if (error || !data) return alert('User not found');

  const password_hash = await hashString(username + password);
  if (password_hash !== data.password_hash) return alert('Incorrect password');

  // successful login
  localStorage.currentUser = username;
  startChat(username);
});

// ===== Check for saved session =====
window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.currentUser;
  if (savedUser) startChat(savedUser);
});

// ===== Start Chat =====
function startChat(username) {
  authContainer.style.display = 'none';
  chatContainer.style.display = 'flex';
  currentUserSpan.textContent = username;

  loadMessages();
  subscribeMessages();
}

// ===== Load Existing Messages =====
async function loadMessages() {
  const { data } = await supabase.from('messages').select('username, content').order('created_at', { ascending: true });
  if (data) data.forEach(msg => appendMessage(msg.username, msg.content));
}

// ===== Append Message to UI =====
function appendMessage(user, content) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  msgDiv.innerHTML = `<strong>${user}:</strong> ${content}`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ===== Send New Message =====
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;

  const username = localStorage.currentUser;
  await supabase.from('messages').insert([{ username, content }]);
  input.value = '';
});

// ===== Logout =====
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  window.location.reload();
});

// ===== Realtime subscription =====
function subscribeMessages() {
  supabase.channel('chat-room')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      appendMessage(payload.new.username, payload.new.content);
    })
    .subscribe();
}
