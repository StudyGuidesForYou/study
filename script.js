// ---------- IMPORTANT: paste your Supabase values here ----------
const SUPABASE_URL = "https://gwgrxmmugsjnflvcybcq.supabase.co"; // <-- REPLACE
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0";                    // <-- REPLACE

// ---------- wait-for-supabase helper ----------
async function waitForSupabase(timeoutMs = 4000) {
  const start = Date.now();
  while (!window.supabase) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise(r => setTimeout(r, 100));
  }
  return !!window.supabase;
}

(async function main() {
  console.debug("[chat] waiting for supabase library...");
  const okLib = await waitForSupabase(4000);
  if (!okLib) {
    console.error("[chat] Supabase library not loaded. If CDN blocked, download supabase.min.js and put it at ./libs/supabase.js");
    alert("Supabase library not loaded. Check console.");
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.debug("[chat] Supabase client created", sb);

  // DOM references
  const nameModal = document.getElementById("name-modal");
  const displayNameInput = document.getElementById("display-name");
  const enterBtn = document.getElementById("enter-chat");
  const rememberChk = document.getElementById("remember-name");

  const app = document.getElementById("app");
  const myNameEl = document.getElementById("my-name");
  const changeNameBtn = document.getElementById("change-name");

  const messagesEl = document.getElementById("messages");
  const msgForm = document.getElementById("message-form");
  const msgInput = document.getElementById("message-input");
  const typingIndicator = document.getElementById("typing-indicator");

  // Helpers: save/clear/get display name
  function getSavedName() {
    return sessionStorage.getItem("displayName") || localStorage.getItem("displayName");
  }
  function saveName(n, remember) {
    sessionStorage.setItem("displayName", n);
    if (remember) localStorage.setItem("displayName", n);
  }
  function clearSavedName() {
    sessionStorage.removeItem("displayName");
    localStorage.removeItem("displayName");
  }

  // show/hide
  function openAppAs(name) {
    nameModal.style.display = "none";
    app.classList.remove("hidden");
    myNameEl.textContent = name;
    loadMessages();
    subscribeMessages();
  }

  // initialize name
  const saved = getSavedName();
  if (saved) {
    displayNameInput.value = saved;
    saveName(saved, true);
    openAppAs(saved);
  } else {
    nameModal.style.display = "";
    app.classList.add("hidden");
  }

  // enter chat
  enterBtn.addEventListener('click', () => {
    const name = displayNameInput.value.trim();
    if (!name) return alert("Enter a display name");
    saveName(name, rememberChk.checked);
    openAppAs(name);
  });

  // change name
  changeNameBtn.addEventListener('click', () => {
    clearSavedName();
    location.reload();
  });

  // load messages (last 500)
  async function loadMessages() {
    try {
      const { data, error } = await sb
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) {
        console.error('[chat] loadMessages error', error);
        return;
      }
      messagesEl.innerHTML = '';
      (data || []).forEach(renderMessageRow);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      console.debug('[chat] loaded', data?.length || 0, 'messages');
    } catch (err) {
      console.error('[chat] loadMessages crashed', err);
    }
  }

  // render a message
  function renderMessageRow(row) {
    const li = document.createElement('li');
    li.className = 'message';
    li.dataset.id = row.id;
    const ts = row.created_at ? new Date(row.created_at).toLocaleTimeString() : '';
    li.innerHTML = `
      <div class="message-meta"><strong>${escapeHtml(row.username)}</strong> <span class="muted">· ${ts}</span></div>
      <div class="text">${escapeHtml(row.message)}</div>
      <div style="margin-top:8px"><button data-action="delete">Delete</button></div>
    `;
    const btn = li.querySelector('[data-action="delete"]');
    if ((getSavedName() || '') !== row.username) btn.style.display = 'none';
    else btn.addEventListener('click', async () => {
      if (!confirm('Delete this message?')) return;
      const { error } = await sb.from('messages').delete().eq('id', row.id);
      if (error) return console.error('delete error', error);
      li.remove();
    });
    messagesEl.appendChild(li);
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  // send message
  msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (!text) return;
    const username = getSavedName() || 'Anon';
    try {
      const { data, error } = await sb.from('messages').insert([{ username, message: text }]);
      if (error) {
        console.error('[chat] send error', error);
        return;
      }
      msgInput.value = '';
      // realtime subscription will append the message when it appears in DB
    } catch (err) {
      console.error('[chat] send crashed', err);
    }
  });

  // typing indicator (local)
  let typingTimer = null;
  msgInput.addEventListener('input', () => {
    typingIndicator.textContent = `${getSavedName() || 'Someone'} is typing...`;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=> typingIndicator.textContent = '', 900);
  });

  // realtime subscription
  let channel = null;
  function subscribeMessages() {
    if (channel) {
      try { sb.removeChannel(channel); } catch(_) {}
      channel = null;
    }
    channel = sb.channel('public:messages');
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      renderMessageRow(payload.new);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
    channel.subscribe(status => {
      console.debug('[chat] realtime status', status);
    });
  }

  // done
  console.debug('[chat] initialized');
})();
