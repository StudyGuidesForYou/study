// ===== Supabase Setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

let supabase;
let currentUser;
let userNumber = 1;

// ===== DOM Elements =====
const usernameContainer = document.getElementById("username-container");
const usernameInput = document.getElementById("username-input");
const enterChatBtn = document.getElementById("enter-chat");

const chatContainer = document.getElementById("chat-container");
const currentUserSpan = document.getElementById("current-user");
const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");

// ===== Initialize after page load =====
window.onload = async () => {
  console.log("[STATUS] Initializing Supabase client...");
  
  if (!window.supabase) {
    console.error("[ERROR] Supabase library not loaded!");
    alert("Supabase library not loaded. Check console.");
    return;
  }
  
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("[STATUS] Supabase client ready.");
};

// ===== Enter Chat =====
enterChatBtn.onclick = () => {
  const name = usernameInput.value.trim();
  currentUser = name || `user_${userNumber++}`;
  usernameContainer.style.display = "none";
  chatContainer.style.display = "flex";
  currentUserSpan.textContent = currentUser;

  loadMessages();
  subscribeMessages();
};

// ===== Load Last 500 Messages =====
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
      appendMessage(msg.username, msg.message);
    });
    messages.scrollTop = messages.scrollHeight;
  } catch (err) {
    console.error("[ERROR] Loading messages:", err);
  }
}

// ===== Append Message to Chat =====
function appendMessage(username, message) {
  const li = document.createElement("li");
  li.textContent = `${username}: ${message}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// ===== Send Message =====
form.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg || !currentUser) return;

  try {
    await supabase.from('messages').insert([{ username: currentUser, message: msg }]);
    input.value = "";
  } catch (err) {
    console.error("[ERROR] Sending message:", err);
  }
});

// ===== Real-Time Subscription =====
function subscribeMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      appendMessage(payload.new.username, payload.new.message);
    })
    .subscribe();
}

// ===== Enter Key Support =====
input.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    form.dispatchEvent(new Event("submit"));
  }
});
