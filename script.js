// ✅ SET THESE:
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const messagesUI = document.getElementById("messages");
const input = document.getElementById("input");
const form = document.getElementById("chat-form");
const userLabel = document.getElementById("user-label");
const typingIndicator = document.getElementById("typing-indicator");

let username = null;
let typingTimeout = null;

// ✅ Auto-generate username: user_1, user_2, user_3...
async function assignUser() {
  const stored = localStorage.getItem("user_name");
  if (stored) {
    username = stored;
    userLabel.textContent = username;
    return;
  }

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true });

  const userNum = (count || 0) + 1;
  username = `user_${userNum}`;
  localStorage.setItem("user_name", username);
  userLabel.textContent = username;
}

// ✅ Load messages
async function loadMessages() {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .order("id", { ascending: true });

  messagesUI.innerHTML = "";
  data.forEach(addMessageToUI);
}

// ✅ Live updates
function subscribeRealtime() {
  supabase.channel("realtime-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => addMessageToUI(payload.new)
    )
    .subscribe();
}

// ✅ Add message to UI
function addMessageToUI(msg) {
  const li = document.createElement("li");
  li.textContent = `${msg.username}: ${msg.message}`;
  messagesUI.appendChild(li);
  messagesUI.scrollTop = messagesUI.scrollHeight;
}

// ✅ Send message
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (input.value.trim() === "") return;

  await supabase.from("messages").insert({
    username: username,
    message: input.value
  });

  input.value = "";
});

// ✅ Typing indicator
input.addEventListener("input", () => {
  typingIndicator.textContent = `${username} is typing...`;

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingIndicator.textContent = "";
  }, 700);
});

// ✅ Initialize
(async function start() {
  await assignUser();
  await loadMessages();
  subscribeRealtime();
})();
