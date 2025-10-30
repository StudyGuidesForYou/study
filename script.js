// ===== Supabase Setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

console.log("[chat] Initializing Supabase client...");
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// DOM Elements
const displayContainer = document.getElementById("display-container");
const displayInput = document.getElementById("display-name");
const enterButton = document.getElementById("enter-chat");
const displayMsg = document.getElementById("display-msg");

const chatContainer = document.getElementById("chat-container");
const messages = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const userLabel = document.getElementById("user-label");

// ===== Enter chat =====
enterButton.onclick = () => {
  let name = displayInput.value.trim();
  if (!name) {
    displayMsg.textContent = "Please enter a display name!";
    return;
  }
  currentUser = name;
  localStorage.setItem("chat_username", currentUser);
  displayContainer.style.display = "none";
  chatContainer.style.display = "flex";
  userLabel.textContent = currentUser;
  console.log(`[chat] Entered as ${currentUser}`);
  loadMessages();
  subscribeMessages();
};

// ===== Load saved username =====
window.onload = () => {
  const saved = localStorage.getItem("chat_username");
  if (saved) {
    currentUser = saved;
    displayContainer.style.display = "none";
    chatContainer.style.display = "flex";
    userLabel.textContent = currentUser;
    console.log(`[chat] Using saved username: ${currentUser}`);
    loadMessages();
    subscribeMessages();
  }
};

// ===== Load last messages =====
async function loadMessages() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) throw error;

    messages.innerHTML = "";
    data.forEach(msg => {
      const li = document.createElement("li");
      li.textContent = `${msg.username}: ${msg.message}`;
      messages.appendChild(li);
    });
    messages.scrollTop = messages.scrollHeight;
  } catch (err) {
    console.error("[chat] Load messages error:", err);
  }
}

// ===== Send message =====
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg || !currentUser) return;

  try {
    console.log("[chat] Sending message:", msg);
    const { data, error } = await supabase
      .from('messages')
      .insert([{ username: currentUser, message: msg }]);

    if (error) throw error;
    chatInput.value = "";
  } catch (err) {
    console.error("[chat] Send message error:", err);
  }
});

// ===== Subscribe to realtime messages =====
function subscribeMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      console.log("[chat] New message:", payload.new);
      const li = document.createElement("li");
      li.textContent = `${payload.new.username}: ${payload.new.message}`;
      messages.appendChild(li);
      messages.scrollTop = messages.scrollHeight;
    })
    .subscribe();
}
