// ------------------------
// Supabase Setup
// ------------------------
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

if (!window.supabase) {
    alert("Supabase library not loaded. Check console.");
    throw new Error("Supabase library not found");
}

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------
// DOM Elements
// ------------------------
const messages = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('input');

// ------------------------
// Load last messages
// ------------------------
async function loadMessages() {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500);

    if (error) console.error("[chat] Load error:", error);
    messages.innerHTML = "";
    if (data) data.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m.message;
        messages.appendChild(li);
    });
    messages.scrollTop = messages.scrollHeight;
}

// ------------------------
// Send message
// ------------------------
form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;

    const { data, error } = await supabase
        .from('messages')
        .insert([{ message: msg }]);
    if (error) console.error("[chat] Send error:", error);
    else input.value = "";
});

input.addEventListener('keydown', e => {
    if (e.key === 'Enter') form.dispatchEvent(new Event('submit', { cancelable:true }));
});

// ------------------------
// Real-time subscription
// ------------------------
function subscribeMessages() {
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
            const li = document.createElement('li');
            li.textContent = payload.new.message;
            messages.appendChild(li);
            messages.scrollTop = messages.scrollHeight;
        })
        .subscribe();
}

// ------------------------
// Initialize
// ------------------------
loadMessages();
subscribeMessages();
