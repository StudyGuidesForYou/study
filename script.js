// Supabase config
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

// DOM
const authContainer = document.getElementById("auth-container");
const chatContainer = document.getElementById("chat-container");
const authMsg = document.getElementById("auth-msg");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const currentUserSpan = document.getElementById("current-user");

// Check session
window.addEventListener('load', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if(session){
    currentUser = session.user.email;
    showChat();
  }
});

// Show chat
function showChat() {
  authContainer.style.display = "none";
  chatContainer.style.display = "flex";
  currentUserSpan.textContent = currentUser;
  loadMessages();
  subscribeMessages();
}

// Register
document.getElementById("register").onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const username = usernameInput.value;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if(error) authMsg.textContent = error.message;
  else {
    authMsg.style.color = "#0f0";
    authMsg.textContent = "Check your email to confirm!";
  }
};

// Login
document.getElementById("login").onclick = async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if(error){
    authMsg.style.color = "#f55";
    authMsg.textContent = error.message;
  } else {
    currentUser = email;
    showChat();
  }
};

// Logout
document.getElementById("logout").onclick = async () => {
  await supabase.auth.signOut();
  currentUser = null;
  chatContainer.style.display = "none";
  authContainer.style.display = "flex";
  authMsg.textContent = "";
};

// Load messages
async function loadMessages() {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending:true })
    .limit(500);

  messages.innerHTML = "";
  data.forEach(m=>{
    const li = document.createElement("li");
    li.textContent = `${m.username || m.email}: ${m.message}`;
    messages.appendChild(li);
  });
  messages.scrollTop = messages.scrollHeight;
}

// Send message
form.addEventListener("submit", async e=>{
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg || !currentUser) return;

  await supabase.from('messages').insert([{
    username: usernameInput.value || currentUser,
    message: msg
  }]);

  input.value = "";
});

// Realtime subscription
function subscribeMessages() {
  supabase.channel('public:messages')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload=>{
      const li = document.createElement("li");
      li.textContent = `${payload.new.username || payload.new.email}: ${payload.new.message}`;
      messages.appendChild(li);
      messages.scrollTop = messages.scrollHeight;
    })
    .subscribe();
}
