/* ---------- CONFIG ---------- */
/* Your Supabase values (you provided these earlier) */
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";

/* ---------- Create Supabase client (use window.supabase) ---------- */
const sb = (window && window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

/* ---------- DOM ---------- */
const statusBar = document.getElementById("status-bar");
const messagesUI = document.getElementById("messages");
const inputEl = document.getElementById("input");
const form = document.getElementById("chat-form");
const userLabel = document.getElementById("user-label");
const typingIndicator = document.getElementById("typing-indicator");
const resetBtn = document.getElementById("reset-user");

/* ---------- State ---------- */
let username = null;
let typingTimer = null;
let channel = null;

/* ---------- Debug helpers ---------- */
function logStatus(text, ok = true) {
  console.log("[STATUS]", text);
  statusBar.textContent = text;
  statusBar.style.background = ok ? "#07202a" : "#4a0b0b";
}
function logErr(prefix, err) {
  console.error("[ERROR]", prefix, err);
  const msg = err && err.message ? err.message : String(err);
  logStatus(`${prefix}: ${msg}`, false);
}

/* ---------- Safety check: Supabase lib present ---------- */
if (!sb) {
  logStatus("Supabase library not found — ensure <script src=\"...supabase.min.js\"> is loaded BEFORE script.js", false);
  throw new Error("Supabase client not available");
}

/* ---------- Utilities ---------- */
function appendMessageRow(row) {
  const li = document.createElement("li");
  const ts = row.created_at ? ` (${new Date(row.created_at).toLocaleTimeString()})` : "";
  li.textContent = `${row.username}: ${row.message || row.content || ""}${ts}`;
  messagesUI.appendChild(li);
  messagesUI.scrollTop = messagesUI.scrollHeight;
}

/* ---------- Auto-assign username (user_N) ---------- */
async function assignAutoUser() {
  try {
    const saved = localStorage.getItem("user_name");
    if (saved) {
      username = saved;
      userLabel.textContent = username;
      logStatus("Using saved username: " + username);
      return;
    }
    // Attempt to get a count of messages for numbering
    const res = await sb.from("messages").select("*", { head: true, count: "exact" });
    console.log("count res", res);
    const count = res?.count || 0;
    username = `user_${count + 1}`;
    localStorage.setItem("user_name", username);
    userLabel.textContent = username;
    logStatus("Assigned username: " + username);
  } catch (err) {
    logErr("assignAutoUser failed", err);
    username = `user_${Math.floor(Math.random()*10000)}`;
    localStorage.setItem("user_name", username);
    userLabel.textContent = username;
  }
}

/* ---------- Load recent messages ---------- */
async function loadMessages() {
  try {
    const { data, error } = await sb.from("messages").select("*").order("id", { ascending: true }).limit(500);
    console.log("loadMessages result:", { data, error });
    if (error) {
      logErr("Failed to load messages", error);
      return;
    }
    messagesUI.innerHTML = "";
    (data || []).forEach(appendMessageRow);
    logStatus(`Loaded ${data?.length || 0} messages`);
  } catch (err) {
    logErr("loadMessages crashed", err);
  }
}

/* ---------- Send message (button or Enter) ---------- */
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  try {
    logStatus("Sending...");
    const { data, error } = await sb.from("messages").insert([{ username, message: text }]);
    console.log("insert result:", { data, error });
    if (error) {
      logErr("Insert failed", error);
      return;
    }
    inputEl.value = "";
    logStatus("Message sent");
    // Realtime subscription will append when DB inserts replicate
  } catch (err) {
    logErr("Send error", err);
  }
});

/* ---------- Typing indicator (local) ---------- */
inputEl.addEventListener("input", () => {
  typingIndicator.textContent = `${username} is typing...`;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { typingIndicator.textContent = ""; }, 800);
});

/* ---------- Realtime subscription ---------- */
function subscribeRealtime() {
  try {
    if (channel) {
      try { sb.removeChannel(channel); } catch (_) { /* ignore */ }
      channel = null;
    }
    channel = sb.channel("public:messages");
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      console.log("Realtime payload:", payload);
      appendMessageRow(payload.new);
    });
    channel.subscribe(status => {
      console.log("Realtime status", status);
      if (status === 'SUBSCRIBED') logStatus("Realtime subscribed");
    });
  } catch (err) {
    logErr("subscribeRealtime failed", err);
  }
}

/* ---------- Reset assigned user ---------- */
resetBtn.addEventListener("click", () => {
  localStorage.removeItem("user_name");
  logStatus("Username cleared. Reloading...");
  setTimeout(() => location.reload(), 300);
});

/* ---------- Bootstrap ---------- */
(async function init() {
  try {
    logStatus("Initializing...");
    await assignAutoUser();
    await loadMessages();
    subscribeRealtime();
    logStatus("Ready — send a message!");
  } catch (err) {
    logErr("Bootstrap failed", err);
  }
})();
