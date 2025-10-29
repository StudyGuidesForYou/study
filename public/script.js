// ===== Supabase setup =====
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

// ===== DOM elements =====
const authContainer = document.getElementById("auth-container");
const chatContainer = document.getElementById("chat-container");
const authMsg = document.getElementById("auth-msg");
const usernameInput = document.getElementById("username"); // optional display name
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");

// ===== CHECK SESSION ON LOAD =====
window.addEventListener('load', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user.email;
    authContainer.style.display = "none";
    chatContainer.style.display = "flex";
    loadMessages();
    subscribeMessages();
  }
});

// ===== REGISTER =====
document.getElementById("register").onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    authMsg.textContent = error.message;
  } else {
    authMsg.textContent = "Check your email to confirm!";
  }
};

// ===== LOGIN =====
document.getElementById("login").onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authMsg.textContent = error.message;
  } else {
    currentUser = email;
    authContainer.style.display = "none";
    chatContainer.style.display = "flex";
    loadMessages();
    subscribeMessages();
  }
};

// ===== LOGOUT =====
document.getElementById("logout").onclick = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  chatContainer.style.display = "none";
  authContainer.style.display = "flex";
};

// ===== LOAD LAST MESSAGES =====
async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(500);

  messages.innerHTML = "";
  data.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${m.username || m.email}: ${m.message}`;
    messages.appendChild(li);
  });
  messages.scrollTop = messages.scrollHeight;
}

// ===== SEND MESSAGE =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg || !currentUser) return;

  await supabase.from('messages').insert([{
    username: usernameInput.value || currentUser,
    message: msg
  }]);

  input.value = "";
});

// ===== REAL-TIME SUBSCRIPTION =====
function subscribeMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const li = document.createElement("li");
      li.textContent = `${payload.new.username || payload.new.email}: ${payload.new.message}`;
      messages.appendChild(li);
      messages.scrollTop = messages.scrollHeight;
    })
    .subscribe();
}
