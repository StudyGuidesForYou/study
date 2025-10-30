// ------------------------
// Supabase Setup
// ------------------------
console.log("[chat] Initializing Supabase client...");
const SUPABASE_URL = 'https://gwgrxmmugsjnflvcybcq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z3J4bW11Z3NqbmZsdmN5YmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY2ODYsImV4cCI6MjA3NzMyMjY4Nn0.uWYdfGWEwo9eRcSMYs0E_t-QVVlupf8An0OAgypY8O0';

if (!window.supabase) {
    alert("Supabase library not loaded. Check console.");
    console.error("[chat] Supabase library not loaded. Ensure the CDN script is BEFORE script.js");
} 

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------
// DOM Elements
// ------------------------
const displayContainer = document.getElementById('display-name-container');
const displayInput = document.getElementById('display-name-input');
const startButton = document.getElementById('start-chat');
const nameMsg = document.getElementById('name-msg');

const chatContainer = document.getElementById('chat-container');
const currentUserSpan = document.getElementById('current-user');
const messages = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('input');

let currentUser = null;

// ------------------------
// Display name handling
// ------------------------
startButton.onclick = () => {
    const name = displayInput.value.trim();
    if (!name) {
        nameMsg.textContent = "Please enter a display name!";
        return;
    }
    currentUser = name;
    localStorage.setItem('chatUser', currentUser);
    startChat();
};

function startChat() {
    displayContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    currentUserSpan.textContent = currentUser;

    loadMessages();
    subscribeMessages();
}

// Check if user already stored
window.addEventListener('load', () => {
    const saved = localStorage.getItem('chatUser');
    if (saved) {
        currentUser = saved;
        startChat();
    }
});

// ------------------------
// Load messages
// ------------------------
async function loadMessages() {
    console.log("[chat] Loading last messages...");
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500);

    if (error) console.error(error);

    messages.innerHTML = "";
    if (data) {
        data.forEach(m => {
            const li = document.createElement('li');
            li.textContent = `${m.username}: ${m.message}`;
            messages.appendChild(li);
        });
        messages.scrollTop = messages.scrollHeight;
    }
}

// ------------------------
// Send message
// ------------------------
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg || !currentUser) return;

    console.log("[chat] Sending message:", msg);

    const { data, error } = await supabase
        .from('messages')
        .insert([{ username: currentUser, message: msg }]);

    if (error) console.error("[chat] Send error:", error);
    else input.value = "";
});

// Enter key support
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') form.dispatchEvent(new Event('submit', { cancelable: true }));
});

// ------------------------
// Real-time subscription
// ------------------------
function subscribeMessages() {
    console.log("[chat] Subscribing to messages...");
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const li = document.createElement('li');
            li.textContent = `${payload.new.username}: ${payload.new.message}`;
            messages.appendChild(li);
            messages.scrollTop = messages.scrollHeight;
        })
        .subscribe();
}
