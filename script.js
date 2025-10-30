console.log("[chat] Starting chat script...");

// ✅ Supabase is attached to window as `window.supabase`
if (!window.supabase) {
    console.error("Supabase library did not load!");
} else {
    console.log("[chat] Supabase loaded ✅");
}

// ✅ Create client
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");

// ✅ Load messages
async function loadMessages() {
    console.log("[chat] Loading messages...");

    const { data, error } = await db
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) return console.error(error);

    messages.innerHTML = "";
    data.forEach(row => addMessage(row.message));
}

// ✅ Add message to UI
function addMessage(text) {
    const li = document.createElement("li");
    li.textContent = text;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
}

// ✅ Sending messages
form.addEventListener("submit", async e => {
    e.preventDefault();

    const msg = input.value.trim();
    if (!msg) return;

    input.value = "";

    const { error } = await db
        .from("messages")
        .insert([{ message: msg }]);

    if (error) console.error(error);
});

// ✅ Realtime subscription
db.channel("public:messages")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
      addMessage(payload.new.message);
  })
  .subscribe();


// ✅ Initialize
loadMessages();
