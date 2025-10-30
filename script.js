// =====================
// Supabase Setup
// =====================
console.log("[chat] Loading Supabase...");

const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";

if (!window.supabase) {
    alert("Supabase JS failed to load!");
    throw new Error("Supabase library missing");
}

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================
// DOM
// =====================
const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");

// random user ID (ignored in UI)
const currentUser = "user_" + Math.floor(Math.random() * 99999);

// =====================
// Load old messages
// =====================
async function loadMessages() {
    console.log("[chat] Loading messages...");

    const { data, error } = await db
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("[chat] load error:", error);
        return;
    }

    messages.innerHTML = "";

    data.forEach(msg => {
        appendMessage(msg.message);
    });

    messages.scrollTop = messages.scrollHeight;
}

// =====================
// Append to UI
// =====================
function appendMessage(text) {
    const li = document.createElement("li");
    li.textContent = text;
    messages.appendChild(li);
}

// =====================
// Sending messages
// =====================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    input.value = "";

    const { error } = await db
        .from("messages")
        .insert([{ username: currentUser, message: text }]);

    if (error) console.error("[chat] insert error:", error);
});

// ENTER key support
input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
});

// =====================
// Realtime Subscriptions
// =====================
console.log("[chat] Connecting to realtime...");

db.channel("public:messages")
  .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages"
  }, payload => {
      appendMessage(payload.new.message);
      messages.scrollTop = messages.scrollHeight;
  })
  .subscribe();

// =====================
// READY
// =====================
loadMessages();
