const socket = io();
let currentUser = null;

const authContainer = document.getElementById("auth-container");
const chatContainer = document.getElementById("chat-container");
const authMsg = document.getElementById("auth-msg");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const messages = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("input");

document.getElementById("register").onclick = async () => {
  const username = usernameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;
  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ username, password, email })
  });
  authMsg.textContent = await res.text();
};

document.getElementById("login").onclick = async () => {
  const username = usernameInput.value;
  const password = passwordInput.value;
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ username, password })
  });
  if(res.ok) {
    currentUser = username;
    authContainer.style.display = "none";
    chatContainer.style.display = "flex";
    loadMessages();
  } else {
    authMsg.textContent = await res.text();
  }
};

// Load last messages
async function loadMessages() {
  const res = await fetch("/messages");
  const msgs = await res.json();
  messages.innerHTML = "";
  msgs.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${m.username}: ${m.message}`;
    messages.appendChild(li);
  });
  messages.scrollTop = messages.scrollHeight;
}

// Send message
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if(!currentUser) return;
  const msg = input.value;
  if(msg.trim() === "") return;
  socket.emit("chat message", { username: currentUser, message: msg });
  input.value = "";
});

// Receive messages
socket.on("chat message", (data) => {
  const li = document.createElement("li");
  li.textContent = `${data.username}: ${data.message}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});
