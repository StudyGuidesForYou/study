// ===== Supabase setup =====
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";

console.log("[chat] Initializing Supabase client...");
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let username = null;

// ===== DOM =====
const displayContainer = document.getElementById("display-container");
const displayInput = document.getElementById("display-name-input");
const displayButton = document.getElementById("set-display-name");
const displayMsg = document.getElementById("display-msg");

const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const messagesList = document.getElementById("messages");

// ===== Handle Display Name =====
displayButton.onclick = async () => {
  let name = displayInput.value.trim();
  if(!name) {
    displayMsg.textContent = "Please enter a display name!";
    return;
  }
  username = name;
  localStorage.setItem("chat_username", username);
  displayContainer.style.display = "none";
  chatContainer.style.display = "flex";
  console.log("[chat] Username set:", username);
  loadMessages();
  subscribeMessages();
};

const savedName = localStorage.getItem("chat_username");
if(savedName) {
  username = savedName;
  displayContainer.style.display = "none";
  chatContainer.style.display = "flex";
  loadMessages();
  subscribeMessages();
}

// ===== Load last messages =====
async function loadMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);

  if(error) { console.error(error); return; }

  messagesList.innerHTML = "";
  data.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${m.username}: ${m.message}`;
    messagesList.appendChild(li);
  });
  messagesList.scrollTop = messagesList.scrollHeight;
}

// ===== Send message =====
chatForm.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if(!msg) return;

  console.log("[chat] Sending...", msg);
  const { data, error } = await supabase
    .from("messages")
    .insert([{ username, message: msg }]);

  if(error) console.error("Send error", error);
  chatInput.value = "";
});

// ===== Realtime subscription =====
function subscribeMessages() {
  supabase
    .channel("public:messages")
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, payload => {
      const m = payload.new;
      const li = document.createElement("li");
      li.textContent = `${m.username}: ${m.message}`;
      messagesList.appendChild(li);
      messagesList.scrollTop = messagesList.scrollHeight;
      console.log("[chat] New message:", m);
    })
    .subscribe();
}
