// ---------- CONFIG (replace these) ----------
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co"; // e.g. https://xyz.supabase.co
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";    // anon key (public), NOT service_role

// ---------- INIT CLIENT (correct usage) ----------
const sb = window.supabase && window.supabase.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ---------- DOM ----------
const statusBar = document.getElementById("status-bar");
const messagesUI = document.getElementById("messages");
const input = document.getElementById("input");
const form = document.getElementById("chat-form");
const userLabel = document.getElementById("user-label");
const typingIndicator = document.getElementById("typing-indicator");

let username = null;
let typingTimer = null;
let realtimeChannel = null;

// ---------- UTIL ----------
function setStatus(text, ok = true) {
  statusBar.textContent = text;
  statusBar.style.background = ok ? "#07202a" : "#4a0b0b";
  console.log("[STATUS]", text);
}

function logErrorAndStatus(prefix, err) {
  console.error(prefix, err);
  const msg = err && err.message ? err.message : JSON.stringify(err);
  setStatus(`${prefix}: ${msg}`, false);
}

// ---------- ASSIGN AUTO USER ----------
async function assignUser() {
  try {
    const stored = localStorage.getItem("user_name");
    if (stored) {
      username = stored;
      userLabel.textContent = username;
      setStatus("Using saved username: " + username);
      return;
    }
    // get approximate count of messages to pick a number
    // Use head:true to get count only - PostgREST supports head + count, Supabase .select may return via count option
    const res = await sb.from("messages").select("*", { count: "exact", head: true });
    if (res.error) {
      console.warn("count error (fallback to 0):", res.error);
      const userNum = 1;
      username = `user_${userNum}`;
    } else {
      const cnt = res.count || 0;
      username = `user_${cnt + 1}`;
    }
    localStorage.setItem("user_name", username);
    userLabel.textContent = username;
    setStatus("Assigned username: " + username);
  } catch (err) {
    logErrorAndStatus("Assign user failed", err);
    // fallback
    username = `user_${Math.floor(Math.random()*10000)}`;
    localStorage.setItem("user_name", username);
    userLabel.textContent = username;
  }
}

// ---------- CONNECTION CHECK ----------
async function connectionCheck() {
  if (!sb) {
    setStatus("Supabase library not found — check <script> include.", false);
    throw new Error("Supabase client not available");
  }
  // test a simple select (safe)
  try {
    const { data, error } = await sb.from("messages").select("id").limit(1);
    if (error) {
      logErrorAndStatus("DB read test failed", error);
      throw error;
    }
    setStatus("Connected to Supabase — messages table reachable.");
    return true;
  } catch (err) {
    throw err;
  }
}

// ---------- LOAD MESSAGES ----------
async function loadMessages() {
  try {
    const { data, error } = await sb
      .from("messages")
      .select("*")
      .order("id", { ascending: true })
      .limit(500);
    if (error) {
      logErrorAndStatus("Failed to load messages", error);
      return;
    }
    messagesUI.innerHTML = "";
    (data || []).forEach(row => {
      appendMessageToUI(row);
    });
    setStatus("Loaded messages (" + (data?.length||0) + ")");
  } catch (err) {
    logErrorAndStatus("Load messages error", err);
  }
}

// ---------- APPEND UI ----------
function appendMessageToUI(row) {
  const li = document.createElement("li");
  const time = row.created_at ? ` (${new Date(row.created_at).toLocaleTimeString()})` : "";
  li.textContent = `${row.username}: ${row.message || row.content || ""}${time}`;
  messagesUI.appendChild(li);
  messagesUI.scrollTop = messagesUI.scrollHeight;
}

// ---------- SEND MESSAGE ----------
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const txt = input.value.trim();
  if (!txt) return;
  try {
    setStatus("Sending...");
    const { data, error } = await sb.from("messages").insert([{ username, message: txt }]);
    if (error) {
      logErrorAndStatus("Insert failed", error);
      return;
    }
    input.value = "";
    setStatus("Message sent");
    // note: realtime subscription will also append when DB insert is replicated
  } catch (err) {
    logErrorAndStatus("Send error", err);
  }
});

// allow Enter key (form submit covers it) — keep for safety
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    // let form submit handle
  }
});

// ---------- TYPING INDICATOR (local) ----------
input.addEventListener("input", () => {
  typingIndicator.textContent = username + " is typing...";
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { typingIndicator.textContent = ""; }, 900);
});

// ---------- SUBSCRIBE REALTIME ----------
function subscribeRealtime() {
  try {
    if (realtimeChannel) {
      try { sb.removeChannel(realtimeChannel); } catch(_) {}
      realtimeChannel = null;
    }
    const ch = sb.channel("public:messages");
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      console.log("Realtime INSERT received", payload);
      appendMessageToUI(payload.new);
    });
    ch.subscribe((status) => {
      console.log("channel status", status);
      if (status === 'SUBSCRIBED') setStatus("Realtime subscribed");
    });
    realtimeChannel = ch;
  } catch (err) {
    logErrorAndStatus("Realtime subscribe failed", err);
  }
}

// ---------- BOOTSTRAP ----------
(async function bootstrap() {
  try {
    setStatus("Initializing client...");
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("YOUR_") || SUPABASE_KEY.includes("YOUR_")) {
      setStatus("Please set SUPABASE_URL and SUPABASE_KEY in script.js", false);
      return;
    }
    await assignUser();
    await connectionCheck();   // will throw if fails
    await loadMessages();
    subscribeRealtime();
  } catch (err) {
    // error already logged
    console.error("Bootstrap failed", err);
  }
})();
