// ------------------------
// Supabase Setup
// ------------------------
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

if (!window.supabase) {
    alert("Supabase library not loaded. Check console.");
    throw new Error("Supabase not loaded");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------
// DOM Elements
// ------------------------
const messages = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('input');

// ------------------------
// User ID
// ------------------------
let currentUser = `user_${Math.floor(Math.random() * 10000)}`;

// ------------------------
// Load existing messages
// ------------------------
async function loadMessages() {
    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500);
    if (error) return console.error(error);

    messages.innerHTML = "";
    data.forEach(msg => {
        appendMessage(msg.message);
    });
    messages.scrollTop = messages.scrollHeight;
}

// ------------------------
// Append message
// ------------------------
function appendMessage(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    messages.appendChild(li);
}

// ------------------------
// Send message
// ------------------------
form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;

    input.value = "";

    const { data, error } = await supabaseClient
        .from('messages')
        .insert([{ username: currentUser, message: msg }]);
    if (error) console.error(error);
});

// Support Enter key
input.addEventListener('keydown', e => {
    if (e.key === 'Enter') form.dispatchEvent(new Event('submit', { cancelable: true }));
});

// ------------------------
// Realtime subscription
// ------------------------
supabaseClient
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        appendMessage(payload.new.message);
        messages.scrollTop = messages.scrollHeight;
    })
    .subscribe();

// ------------------------
// Initialize
// ------------------------
loadMessages();
