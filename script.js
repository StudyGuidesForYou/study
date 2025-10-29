// CONFIG
const SUPABASE_URL = "YOUR_URL_HERE";
const SUPABASE_KEY = "YOUR_ANON_KEY_HERE";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const nameScreen = document.getElementById("name-screen");
const chatScreen = document.getElementById("chat-screen");
const enterButton = document.getElementById("enter-chat");
const nameInput = document.getElementById("display-name");
const userLabel = document.getElementById("user-label");
const logoutBtn = document.getElementById("logout-btn");

const messagesUI = document.getElementById("messages");
const input = document.getElementById("input");
const form = document.getElementById("chat-form");
const typingIndicator = document.getElementById("typing-indicator");

let username = null;
let typingTimeout = null;

// ✅ Load saved display name
window.onload = () => {
  const saved = localStorage.getItem("display_name");
  if (saved) {
    username = saved;
    userLabel.textContent = "Logged in as: " + username;
    nameScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    loadMessages();
    subscribeRealtime();
  }
};

// ✅ Enter chat
enterButton.onclick = () => {
  if (nameInput.value.trim() === "") return;

  username = nameInput.value.trim();
  localStorage.setItem("display_name", username);

  userLabel.textContent = "Logged in as: " + username;

  nameScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");

  loadMessages();
  subscribeRealtime();
};

// ✅ Logout
logoutBtn.onclick = () => {
  localStorage.removeItem("display_name");
  location.reload();
};

// ✅ Load existing messages
async function loadMessages() {
  const { data } = await supabase.from("messages").select("*").order("id", { ascending: true });
  messagesUI.innerHTML = "";

  data.forEach(addMessageToUI);
}

// ✅ Subscribe to realtime events
function subscribeRealtime() {
  supabase.channel("chat-room")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
      addMessageToUI(payload.new);
    })
    .subscribe();
}

// ✅ UI helper
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
    username,
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
