/* CodeShare — script.js */

const ROOM_NAME = window.ROOM_NAME;

const LANG_MAP = {
  python: "python",
  javascript: "javascript",
  c: "cpp",
  cpp: "cpp",
  java: "java",
  html: "html",
  css: "css",
  sql: "sql",
};

const EXT_MAP = {
  python: "py",
  javascript: "js",
  c: "c",
  cpp: "cpp",
  java: "java",
  html: "html",
  css: "css",
  sql: "sql",
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const statusDot     = document.getElementById("status-dot");
const statusText    = document.getElementById("status-text");
const userCountNum  = document.getElementById("user-count-num");
const languageSelect = document.getElementById("language-select");
const copyLinkBtn      = document.getElementById("copy-link-btn");
const customizeLinkBtn = document.getElementById("customize-link-btn");
const customizeRoomBtn = document.getElementById("customize-room-btn");
const downloadBtn      = document.getElementById("download-btn");
const chatMessages     = document.getElementById("chat-messages");
const chatForm         = document.getElementById("chat-form");
const chatInput        = document.getElementById("chat-input");
const toast            = document.getElementById("toast");

// ── State ─────────────────────────────────────────────────────────────────────
let editor        = null;
let socket        = null;
let suppressEmit  = false;
let debounceTimer = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2500);
}

function setConnected(connected) {
  if (!statusDot || !statusText) return;
  statusDot.classList.toggle("connected", connected);
  statusDot.classList.toggle("disconnected", !connected);
  statusText.textContent = connected ? "Connected" : "Disconnected";
}

function applyLanguage(lang) {
  if (editor && window.monaco) {
    monaco.editor.setModelLanguage(editor.getModel(), LANG_MAP[lang] || "plaintext");
  }
  if (languageSelect.value !== lang) {
    languageSelect.value = lang;
  }
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
function initSocket() {
  socket = io();

  socket.on("connect", () => {
    setConnected(true);
    socket.emit("join", { room: ROOM_NAME });
  });

  socket.on("disconnect", () => setConnected(false));
  socket.on("connect_error", () => setConnected(false));

  socket.on("init_state", (data) => {
    if (editor && typeof data.code === "string") {
      suppressEmit = true;
      editor.setValue(data.code);
      suppressEmit = false;
    }
    if (data.language) {
      applyLanguage(data.language);
    }
  });

  socket.on("code_update", (data) => {
    if (!editor || typeof data.code !== "string") return;
    if (editor.getValue() === data.code) return;

    const position = editor.getPosition();
    suppressEmit = true;
    editor.setValue(data.code);
    if (position) editor.setPosition(position);
    suppressEmit = false;
  });

  socket.on("language_update", (data) => {
    if (data && data.language) applyLanguage(data.language);
  });

  socket.on("user_count", (data) => {
    if (userCountNum && typeof data.count === "number") {
      userCountNum.textContent = data.count;
    }
  });

  socket.on("chat_message", (data) => {
    if (!data || typeof data.message !== "string") return;
    addChatMessage(data.sender || "Unknown", data.message, data.timestamp);
  });
}

// ── Chat helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addChatMessage(sender, message, timestamp) {
  if (!chatMessages) return;
  const item = document.createElement("div");
  item.className = "chat-item";
  item.innerHTML = `
    <div class="chat-meta"><strong>${escapeHtml(sender)}</strong>${timestamp ? ` • ${formatTimestamp(timestamp)}` : ""}</div>
    <div class="chat-text">${escapeHtml(message)}</div>
  `;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Monaco Editor ─────────────────────────────────────────────────────────────
function initEditor() {
  const container = document.getElementById("editor-container");
  if (!container) return;

  require.config({
    paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" },
  });

  require(["vs/editor/editor.main"], function () {
    editor = monaco.editor.create(container, {
      value: window.INITIAL_CODE || "",
      language: LANG_MAP[window.INITIAL_LANGUAGE] || "python",
      theme: "vs-dark",
      fontSize: 14,
      automaticLayout: true,
      minimap: { enabled: window.innerWidth > 768 },
      wordWrap: "on",
      scrollBeyondLastLine: false,
    });

    editor.onDidChangeModelContent(() => {
      if (suppressEmit) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (socket && socket.connected) {
          socket.emit("code_change", { room: ROOM_NAME, code: editor.getValue() });
        }
      }, 300);
    });
  });
}

// ── Controls ──────────────────────────────────────────────────────────────────
function initControls() {
  if (languageSelect) {
    languageSelect.addEventListener("change", () => {
      const lang = languageSelect.value;
      applyLanguage(lang);
      if (socket && socket.connected) {
        socket.emit("language_change", { room: ROOM_NAME, language: lang });
      }
    });
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = chatInput.value.trim();
      if (!message || !socket || !socket.connected) return;
      socket.emit("chat_message", { room: ROOM_NAME, message });
      chatInput.value = "";
      chatInput.focus();
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => showToast("Invite link copied!"))
          .catch(() => showToast("Could not copy link"));
      } else {
        // Fallback for older browsers
        const input = document.createElement("input");
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        showToast("Invite link copied!");
      }
    });
  }

  if (customizeLinkBtn) {
    customizeLinkBtn.addEventListener("click", async () => {
      const newRoom = prompt("Enter a custom room name for the share link:", ROOM_NAME);
      if (!newRoom) return;
      const trimmed = newRoom.trim();
      if (!/^[a-zA-Z0-9_-]{1,50}$/.test(trimmed)) {
        showToast("Room name must use letters, numbers, hyphens or underscores.");
        return;
      }
      if (trimmed === ROOM_NAME) {
        showToast("This room name is already in use.");
        return;
      }

      const response = await fetch("/customize-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_room: ROOM_NAME, new_room: trimmed }),
      });

      if (response.ok) {
        const result = await response.json();
        showToast("Custom link created. Redirecting...");
        window.location.href = `/${encodeURIComponent(result.new_room)}`;
      } else {
        const error = await response.json().catch(() => ({}));
        showToast(error.error || "Could not customize link.");
      }
    });
  }

  if (customizeRoomBtn) {
    customizeRoomBtn.addEventListener("click", () => {
      customizeLinkBtn?.click();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!editor) return;
      const lang = languageSelect ? languageSelect.value : "python";
      const ext  = EXT_MAP[lang] || "txt";
      const blob = new Blob([editor.getValue()], { type: "text/plain;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${ROOM_NAME}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
setConnected(false);
initEditor();
initControls();
initSocket();
