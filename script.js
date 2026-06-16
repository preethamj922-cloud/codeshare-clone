const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const userCountNum = document.getElementById("user-count-num");
const copyLinkBtn = document.getElementById("copy-link-btn");
const downloadBtn = document.getElementById("download-btn");
const languageSelect = document.getElementById("language-select");
const toast = document.getElementById("toast");
const editorContainer = document.getElementById("editor-container");

let editor;
let socket;
let suppressChange = false;

const languageMap = {
  python: "python",
  javascript: "javascript",
  c: "cpp",
  cpp: "cpp",
  java: "java",
  html: "html",
  css: "css",
  sql: "sql",
};

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function updateStatus(connected) {
  if (!statusDot || !statusText) return;
  statusDot.classList.toggle("connected", connected);
  statusDot.classList.toggle("disconnected", !connected);
  statusText.textContent = connected ? "Connected" : "Disconnected";
}

function getEditorLanguage(lang) {
  return languageMap[lang] || "plaintext";
}

function downloadCode() {
  if (!editor) return;
  const code = editor.getValue();
  const language = languageSelect.value;
  const extension = {
    python: "py",
    javascript: "js",
    c: "c",
    cpp: "cpp",
    java: "java",
    html: "html",
    css: "css",
    sql: "sql",
  }[language] || "txt";
  const filename = `${window.ROOM_NAME || "codeshare"}.${extension}`;
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyLink() {
  const link = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => showToast("Link copied to clipboard!"))
      .catch(() => showToast("Unable to copy link."));
  } else {
    const input = document.createElement("input");
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    showToast("Link copied to clipboard!");
  }
}

function setLanguage(language) {
  const monacoLang = getEditorLanguage(language);
  if (editor) {
    monaco.editor.setModelLanguage(editor.getModel(), monacoLang);
  }
  languageSelect.value = language;
}

function initializeSocket() {
  socket = io();

  socket.on("connect", () => {
    updateStatus(true);
    socket.emit("join", { room: window.ROOM_NAME });
  });

  socket.on("disconnect", () => {
    updateStatus(false);
  });

  socket.on("connect_error", () => {
    updateStatus(false);
  });

  socket.on("init_state", (data) => {
    if (!editor) return;
    suppressChange = true;
    editor.setValue(data.code || "");
    setLanguage(data.language || window.INITIAL_LANGUAGE || "python");
    suppressChange = false;
  });

  socket.on("code_update", (data) => {
    if (!editor || typeof data.code !== "string") return;
    const currentValue = editor.getValue();
    if (currentValue === data.code) return;
    suppressChange = true;
    const position = editor.getPosition();
    editor.setValue(data.code);
    if (position) {
      editor.setPosition(position);
    }
    suppressChange = false;
  });

  socket.on("language_update", (data) => {
    if (!data || !data.language) return;
    setLanguage(data.language);
  });

  socket.on("user_count", (data) => {
    if (!data || typeof data.count !== "number") return;
    userCountNum.textContent = data.count;
  });
}

function initializeEditor() {
  if (!editorContainer) return;

  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
  require(["vs/editor/editor.main"], function () {
    editor = monaco.editor.create(editorContainer, {
      value: window.INITIAL_CODE || "",
      language: getEditorLanguage(window.INITIAL_LANGUAGE || "python"),
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: "on",
    });

    editor.onDidChangeModelContent(() => {
      if (suppressChange) return;
      const code = editor.getValue();
      if (socket && socket.connected) {
        socket.emit("code_change", { room: window.ROOM_NAME, code });
      }
    });
  });
}

function initializeControls() {
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", copyLink);
  }
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadCode);
  }
  if (languageSelect) {
    languageSelect.addEventListener("change", (event) => {
      const language = event.target.value;
      setLanguage(language);
      if (socket && socket.connected) {
        socket.emit("language_change", { room: window.ROOM_NAME, language });
      }
    });
  }
}

function initialize() {
  updateStatus(false);
  initializeEditor();
  initializeControls();
  initializeSocket();
}

initialize();
(function () {
  const ROOM_NAME = window.ROOM_NAME;
  const LANG_MAP = {
    python: "python", javascript: "javascript", c: "c", cpp: "cpp",
    java: "java", html: "html", css: "css", sql: "sql",
  };
  const EXT_MAP = {
    python: "py", javascript: "js", c: "c", cpp: "cpp",
    java: "java", html: "html", css: "css", sql: "sql",
  };

  let editor = null;
  let suppressEmit = false;
  let debounceTimer = null;

  const socket = io();

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const userCountNum = document.getElementById("user-count-num");
  const languageSelect = document.getElementById("language-select");
  const copyBtn = document.getElementById("copy-link-btn");
  const downloadBtn = document.getElementById("download-btn");
  const toast = document.getElementById("toast");

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  function setConnected(connected) {
    statusDot.classList.toggle("connected", connected);
    statusDot.classList.toggle("disconnected", !connected);
    statusText.textContent = connected ? "Connected" : "Disconnected";
  }

  socket.on("connect", () => {
    setConnected(true);
    socket.emit("join", { room: ROOM_NAME });
  });

  socket.on("disconnect", () => setConnected(false));

  socket.on("init_state", (data) => {
    if (editor && typeof data.code === "string") {
      suppressEmit = true;
      editor.setValue(data.code);
      suppressEmit = false;
    }
    if (data.language && languageSelect.value !== data.language) {
      languageSelect.value = data.language;
      applyLanguage(data.language, false);
    }
  });

  socket.on("code_update", (data) => {
    if (!editor) return;
    if (editor.getValue() === data.code) return;
    const position = editor.getPosition();
    suppressEmit = true;
    editor.setValue(data.code);
    if (position) editor.setPosition(position);
    suppressEmit = false;
  });

  socket.on("language_update", (data) => {
    if (languageSelect.value !== data.language) {
      languageSelect.value = data.language;
      applyLanguage(data.language, false);
    }
  });

  socket.on("user_count", (data) => {
    userCountNum.textContent = data.count;
  });

  function applyLanguage(lang, broadcast) {
    if (editor && window.monaco) {
      window.monaco.editor.setModelLanguage(editor.getModel(), LANG_MAP[lang] || "plaintext");
    }
    if (broadcast) {
      socket.emit("language_change", { room: ROOM_NAME, language: lang });
    }
  }

  languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value, true));

  copyBtn.addEventListener("click", () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => showToast("Invite link copied!"))
      .catch(() => showToast("Could not copy link"));
  });

  downloadBtn.addEventListener("click", () => {
    if (!editor) return;
    const lang = languageSelect.value;
    const ext = EXT_MAP[lang] || "txt";
    const blob = new Blob([editor.getValue()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ROOM_NAME}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
  require(["vs/editor/editor.main"], function () {
    editor = monaco.editor.create(document.getElementById("editor-container"), {
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
        socket.emit("code_change", { room: ROOM_NAME, code: editor.getValue() });
      }, 300);
    });
  });
})();
