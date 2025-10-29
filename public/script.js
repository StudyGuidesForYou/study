const socket = io();
const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

// Listen for messages from server
socket.on("chat message", function(msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});

// Send messages to server
form.addEventListener("submit", function(e) {
  e.preventDefault();
  const msg = input.value;
  if(msg.trim() !== "") {
    socket.emit("chat message", msg);
    input.value = "";
  }
});
