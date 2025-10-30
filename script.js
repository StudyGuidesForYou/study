// ===== Supabase setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

let supabase = null;
let displayName = '';
let userNumber = Math.floor(Math.random()*10000); // fallback user_#

// DOM elements
const modal = document.getElementById('display-modal');
const displayInput = document.getElementById('display-name');
const enterBtn = document.getElementById('enter-chat');
const chatContainer = document.getElementById('chat-container');
const userLabel = document.getElementById('user-label');
const messages = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const input = document.getElementById('input');

// ===== Initialize Supabase client =====
window.addEventListener('DOMContentLoaded', () => {
  if (!window.supabase) {
    console.error('[chat] Supabase library not loaded!');
    return;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[chat] Supabase client initialized');
});

// ===== Enter Chat =====
enterBtn.addEventListener('click', () => {
  displayName = displayInput.value.trim() || `user_${userNumber}`;
  modal.style.display = 'none';
  chatContainer.classList.remove('hidden');
  userLabel.textContent = displayName;
  loadMessages();
  subscribeMessages();
});

// ===== Load last messages =====
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending:true });
  if (error) console.error(error);
  else data.forEach(renderMessage);
}

// ===== Subscribe to real-time messages =====
function subscribeMessages() {
  supabase.channel('public:messages')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
      renderMessage(payload.new);
    })
    .subscribe();
}

// ===== Render a message =====
function renderMessage(msg) {
  const li = document.createElement('li');
  li.textContent = `${msg.username}: ${msg.message}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// ===== Send messages =====
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;

  await supabase.from('messages').insert([{ username: displayName, message: msg }]);
  input.value = '';
});

// ===== Send on Enter key =====
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') chatForm.dispatchEvent(new Event('submit'));
});
