// ✅ Correct Supabase initialization
const client = window.supabase.createClient(
  "https://gwgrxmmugsjnflvcybcq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0"
);

// DOM
const messagesUI = document.getElementById("messages");
const input = document.getElementById("input");
const form = document.getElementById("chat-form");
const userLabel = document.getElementById("user-label");
const typingIndicator = document.getElementById("typing-indicator");

let username = null;
let typingTimeout = null;

// ✅ Auto-assign username: user_1, user_2, user_3...
async function assignUser() {
  const stored = localStorage.getItem("user_name");
  if (stored) {
    username = stored;
    userLabel.textContent = username;
    return;
  }

  const { count } = await client
    .from("messages")
    .select("*", { count: "exact", head: true });

  const userNum = (count || 0) + 1;
  username = `user_${userNum}`;
  localStorage.setItem("user_name", username);
  userLabel.textContent = username;
}

// ✅ Load messages
async function loadMessages() {
  const { data } = await client
    .from("messages")
    .select("*")
    .order("id", { ascending: true });

  messagesUI.innerHTML = "";
  data.forEach(addMessageToUI);
}

// ✅ Realtime subscription
function subscribeRealtime() {
  client
    .channel("realtime-chat")
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

// ✅ SEND MESSAGE (button + Enter key)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  await client.from("messages").insert({
    username: username,
    message: text
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

// ✅ Start everything
(async function init() {
  await assignUser();
  await loadMessages();
  subscribeRealtime();
})();
