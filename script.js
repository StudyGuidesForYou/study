// ===== CONFIG =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.supabase) {
    alert("Supabase library not loaded! Check your <script> tag.");
    return;
  }

  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ===== DOM ELEMENTS =====
  const displayContainer = document.getElementById("display-container");
  const chatContainer = document.getElementById("chat-container");
  const displayNameInput = document.getElementById("display-name");
  const enterChatBtn = document.getElementById("enter-chat");
  const messages = document.getElementById("messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("input");
  const currentUserEl = document.getElementById("current-user");

  let username = localStorage.getItem('chat_username') || null;

  // ===== ENTER CHAT =====
  enterChatBtn.addEventListener('click', () => {
    let name = displayNameInput.value.trim();
    if (!name) name = `user_${Math.floor(Math.random()*10000)}`;
    username = name;
    localStorage.setItem('chat_username', username);
    currentUserEl.textContent = username;
    displayContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    loadMessages();
    subscribeMessages();
  });

  // Enter key works
  displayNameInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') enterChatBtn.click();
  });

  // ===== LOAD MESSAGES =====
  async function loadMessages() {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending:true }).limit(1000);
    messages.innerHTML = '';
    if (data) {
      data.forEach(msg => {
        addMessage(msg.username, msg.message);
      });
      messages.scrollTop = messages.scrollHeight;
    }
  }

  // ===== ADD MESSAGE =====
  function addMessage(user, text) {
    const li = document.createElement('li');
    li.textContent = `${user}: ${text}`;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }

  // ===== SEND MESSAGE =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if(!msg || !username) return;
    await supabase.from('messages').insert([{ username, message: msg }]);
    input.value = '';
  });

  input.addEventListener('keypress', async (e) => {
    if(e.key === 'Enter') form.dispatchEvent(new Event('submit'));
  });

  // ===== REAL-TIME =====
  function subscribeMessages() {
    supabase.channel('public:messages')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
        addMessage(payload.new.username, payload.new.message);
      })
      .subscribe();
  }

  // ===== AUTO LOAD IF USER ALREADY SAVED =====
  if(username) {
    currentUserEl.textContent = username;
    displayContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    loadMessages();
    subscribeMessages();
  }
});
