// ===== Supabase Setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// ===== DOM =====
const usernamePrompt = document.getElementById('username-prompt');
const displayNameInput = document.getElementById('displayNameInput');
const enterChatBtn = document.getElementById('enterChat');

const chatContainer = document.getElementById('chat-container');
const currentUserSpan = document.getElementById('current-user');
const messagesUl = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const typingIndicator = document.getElementById('typing-indicator');

// ===== Generate User ID =====
function generateUser() {
  const saved = localStorage.getItem('chatUser');
  if(saved) return saved;
  const userId = `user_${Math.floor(Math.random()*10000)}`;
  localStorage.setItem('chatUser', userId);
  return userId;
}

// ===== Enter Chat =====
enterChatBtn.onclick = () => {
  let name = displayNameInput.value.trim() || generateUser();
  currentUser = name;
  localStorage.setItem('chatUser', currentUser);
  usernamePrompt.style.display = 'none';
  chatContainer.style.display = 'flex';
  currentUserSpan.textContent = currentUser;
  loadMessages();
  subscribeMessages();
};

// ===== Send Message =====
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if(!msg) return;
  try {
    await supabase.from('messages').insert([{ username: currentUser, message: msg }]);
    chatInput.value = '';
  } catch(err) { console.error('Send failed', err); }
});

// ===== Enter key for send =====
chatInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') chatForm.dispatchEvent(new Event('submit'));
});

// ===== Load last messages =====
async function loadMessages() {
  const { data } = await supabase.from('messages').select('*').order('id', { ascending:true }).limit(200);
  messagesUl.innerHTML = '';
  data.forEach(m => appendMessage(m.username, m.message));
}

// ===== Append Message =====
function appendMessage(user, text) {
  const li = document.createElement('li');
  li.textContent = `${user}: ${text}`;
  messagesUl.appendChild(li);
  messagesUl.scrollTop = messagesUl.scrollHeight;
}

// ===== Real-time subscription =====
function subscribeMessages() {
  supabase.channel('public:messages')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
      appendMessage(payload.new.username, payload.new.message);
    })
    .subscribe();
}
