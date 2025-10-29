// ===== Supabase setup =====
const SUPABASE_URL = 'YOUR_PROJECT_URL'; // replace with your Supabase project URL
const SUPABASE_KEY = 'YOUR_ANON_KEY';    // replace with your anon key
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
    .limit(500); // keeps last 500 messages

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
