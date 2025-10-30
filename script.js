// ===== Supabase setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

console.log('[chat] Initializing Supabase client...');
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== DOM elements =====
const displayContainer = document.getElementById("display-name-container");
const chatContainer = document.getElementById("chat-container");
const displayInput = document.getElementById("display-name-input");
const enterChatBtn = document.getElementById("enter-chat");
const displayMsg = document.getElementById("display-name-msg");

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("input");
const currentUserEl = document.getElementById("current-user");

let username = null;
let userCounter = 1;

// ===== Helpers =====
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Load last messages
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(500);

  if(error) console.error(error);

  messagesEl.innerHTML = '';
  data.forEach(m => {
    const li = document.createElement('li');
    li.textContent = `${m.username}: ${m.message}`;
    messagesEl.appendChild(li);
  });
  scrollToBottom();
}

// Subscribe to real-time messages
function subscribeMessages() {
  supabaseClient
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const li = document.createElement('li');
      li.textContent = `${payload.new.username}: ${payload.new.message}`;
      messagesEl.appendChild(li);
      scrollToBottom();
    })
    .subscribe();
}

// Send a chat message
async function sendMessage(msg) {
  if(!msg || !username) return;

  const { error } = await supabaseClient.from('messages').insert([{ username, message: msg }]);
  if(error) console.error('Send error:', error);
}

// ===== Event listeners =====
enterChatBtn.onclick = () => {
  const name = displayInput.value.trim();
  if(!name) {
    displayMsg.textContent = 'Please enter a display name';
    return;
  }

  username = name || `user_${userCounter++}`;
  currentUserEl.textContent = username;

  displayContainer.style.display = 'none';
  chatContainer.style.display = 'flex';

  loadMessages();
  subscribeMessages();
};

chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if(!msg) return;

  sendMessage(msg);
  chatInput.value = '';
});

chatInput.addEventListener('keydown', e => {
  if(e.key === 'Enter') {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

console.log('[chat] Client initialized. Waiting for user display name...');
