document.addEventListener("DOMContentLoaded", () => {

  console.log("[chat] Initializing...");

  // --- Supabase setup ---
  const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

  if (!supabase) {
    console.error("[chat] Supabase library not loaded!");
    alert("Supabase library not loaded. Check console.");
    return;
  }

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let username = null;

  const displayContainer = document.getElementById("display-name-container");
  const displayInput = document.getElementById("display-name-input");
  const displayBtn = document.getElementById("display-name-btn");
  const displayMsg = document.getElementById("display-name-msg");

  const chatContainer = document.getElementById("chat-container");
  const messages = document.getElementById("messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("input");
  const currentUserSpan = document.getElementById("current-user");

  // Generate user number if needed
  function generateUserNumber() {
    const saved = localStorage.getItem("chatUserNumber");
    if (saved) return saved;
    const num = Math.floor(Math.random() * 10000);
    localStorage.setItem("chatUserNumber", num);
    return num;
  }

  const userNumber = generateUserNumber();

  // --- Display Name ---
  displayBtn.addEventListener("click", () => {
    const val = displayInput.value.trim();
    if (!val) {
      displayMsg.textContent = "Please enter a display name!";
      return;
    }
    username = val + "_" + userNumber;
    console.log("[chat] Using username:", username);
    displayContainer.style.display = "none";
    chatContainer.style.display = "flex";
    currentUserSpan.textContent = username;

    loadMessages();
    subscribeMessages();
  });

  // --- Load messages ---
  async function loadMessages() {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      console.error("[chat] Load messages error:", error);
      return;
    }

    messages.innerHTML = "";
    data.forEach(m => {
      const li = document.createElement("li");
      li.textContent = `${m.username}: ${m.message}`;
      messages.appendChild(li);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  // --- Send message ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg || !username) return;
    input.value = "";

    console.log("[chat] Sending:", msg);

    const { data, error } = await client
      .from('messages')
      .insert([{ username, message: msg }]);

    if (error) {
      console.error("[chat] Send error:", error);
    } else {
      console.log("[chat] Message sent:", data);
    }
  });

  // Allow Enter key to send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") form.dispatchEvent(new Event("submit"));
  });

  // --- Realtime subscription ---
  function subscribeMessages() {
    client.channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const li = document.createElement("li");
        li.textContent = `${payload.new.username}: ${payload.new.message}`;
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
      })
      .subscribe();
  }

});
