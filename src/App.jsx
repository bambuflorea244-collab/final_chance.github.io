// ======================================================================
//  src/App.jsx — Full React UI for Cloudflare Gemini Console
// ======================================================================

import React, { useState, useEffect } from "react";

import {
  setAuthToken,
  clearAuthToken,
  authApi,
  settingsApi,
  foldersApi,
  chatsApi,
  messagesApi,
  attachmentsApi,
} from "./api.js";

// ======================================================================
//  COMPONENT: Loading Dots
// ======================================================================

function LoadingDots() {
  return (
    <span>
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
}

// ======================================================================
//  COMPONENT: Modal
// ======================================================================

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-title">{title}</div>
        <div className="modal-subtitle">{subtitle}</div>
        {children}
        <div className="modal-footer">
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
//  COMPONENT: Lock Screen
// ======================================================================

function AuthLockScreen({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function login() {
    try {
      const r = await authApi.login(password);
      setAuthToken(r.token);
      onUnlock();
    } catch (err) {
      setErr("Invalid password");
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <h2 style={{ marginTop: 0 }}>🔒 Private Gemini Console</h2>

        {err && <div className="error-banner">{err}</div>}

        <input
          type="password"
          placeholder="Enter Master Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "#050204",
            color: "var(--text)",
            fontSize: "14px",
            marginBottom: "12px",
          }}
        />

        <button className="btn btn-primary" onClick={login}>
          Unlock
        </button>
      </div>
    </div>
  );
}

// ======================================================================
//  MAIN APP
// ======================================================================

export default function App() {
  // Authentication
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Global settings
  const [settings, setSettings] = useState(null);

  // Folders
  const [folders, setFolders] = useState([]);

  // Chats
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);

  // Messages
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");

  // ====================================================================
  //  INITIAL AUTH CHECK
  // ====================================================================

  useEffect(() => {
    async function init() {
      try {
        await authApi.check();
        setAuthenticated(true);
      } catch {
        setAuthenticated(false);
      }
      setAuthChecked(true);
    }
    init();
  }, []);

  // ====================================================================
  //  LOAD SETTINGS, FOLDERS & CHATS
  // ====================================================================

  async function loadInitialData() {
    try {
      const [setData, folderData, chatData] = await Promise.all([
        settingsApi.get(),
        foldersApi.list(),
        chatsApi.list(),
      ]);

      setSettings(setData);
      setFolders(folderData);
      setChats(chatData);
    } catch (err) {
      console.error("Failed loading initial data", err);
    }
  }

  useEffect(() => {
    if (authenticated) {
      loadInitialData();
    }
  }, [authenticated]);

  // ====================================================================
  //  SELECT CHAT — LOAD MESSAGES
  // ====================================================================

  async function openChat(chat) {
    setSelectedChat(chat);
    setMessages([]);
    await loadMessages(chat.id);
  }

  async function loadMessages(chatId) {
    setLoadingMessages(true);
    try {
      const data = await messagesApi.list(chatId);
      setMessages(data);
    } finally {
      setLoadingMessages(false);
    }
  }

  // ====================================================================
  //  SEND MESSAGE
  // ====================================================================

  async function sendMessage() {
    if (!input.trim()) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    try {
      const resp = await messagesApi.send(selectedChat.id, text);
      await loadMessages(selectedChat.id);
    } catch (err) {
      alert("Failed to send message:\n" + err.message);
    }

    setSending(false);
  }

  // ====================================================================
  //  ATTACHMENTS
  // ====================================================================

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await attachmentsApi.upload(selectedChat.id, file);
      await loadMessages(selectedChat.id);
    } catch (err) {
      alert("File upload failed:\n" + err.message);
    }
  }

  // ====================================================================
  //  NEW CHAT
  // ====================================================================

  async function createChat() {
    try {
      const chat = await chatsApi.create(newChatTitle || "Untitled chat");
      setChats([chat, ...chats]);
      setShowNewChatModal(false);
      setNewChatTitle("");
      openChat(chat);
    } catch (err) {
      alert("Failed to create chat:\n" + err.message);
    }
  }

  // ====================================================================
  //  UPDATE SETTINGS
  // ====================================================================

  async function saveSettings(values) {
    try {
      await settingsApi.save(values);
      const updated = await settingsApi.get();
      setSettings(updated);
      setShowSettingsModal(false);
    } catch (err) {
      alert("Failed to save settings:\n" + err.message);
    }
  }

  // ====================================================================
  //  LOGOUT
  // ====================================================================

  function logout() {
    clearAuthToken();
    setAuthenticated(false);
  }

  // ====================================================================
  //  RENDER
  // ====================================================================

  if (!authChecked) return null;

  if (!authenticated) {
    return <AuthLockScreen onUnlock={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-title">Private Gemini</div>
            <div className="brand-subtitle">Self-Hosted Console</div>
          </div>
          <div className="chip">Pro</div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowNewChatModal(true)}
        >
          + New Chat
        </button>

        <div className="chat-list">
          {chats.length === 0 && (
            <div className="chat-empty">No chats created yet</div>
          )}

          {chats.map((c) => (
            <div className="chat-row" key={c.id}>
              <button
                className={
                  "chat-item " + (selectedChat?.id === c.id ? "active" : "")
                }
                onClick={() => openChat(c)}
              >
                <span className="icon">💬</span>
                <span className="chat-title">{c.title}</span>
              </button>

              <button
                className="btn btn-sm delete-chat-btn"
                onClick={async () => {
                  if (!confirm("Delete this chat?")) return;
                  await chatsApi.delete(c.id);
                  setChats(chats.filter((x) => x.id !== c.id));
                  if (selectedChat?.id === c.id) {
                    setSelectedChat(null);
                    setMessages([]);
                  }
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn btn-sm" onClick={() => setShowSettingsModal(true)}>
            ⚙ Settings
          </button>
          <button className="btn btn-sm" onClick={logout}>
            🔒 Logout
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="main-header">
          {selectedChat ? (
            <div className="main-header-titles">
              <div className="main-title">{selectedChat.title}</div>
              <div className="main-subtitle">Chat ID: {selectedChat.id}</div>
            </div>
          ) : (
            <div className="main-title">Select a chat</div>
          )}
        </div>

        {/* MESSAGES */}
        <div className="messages">
          {!selectedChat && (
            <div className="empty-state">
              Create or select a chat from the left.
            </div>
          )}

          {selectedChat && loadingMessages && (
            <div className="bubble bubble-model">
              Loading messages... <LoadingDots />
            </div>
          )}

          {selectedChat &&
            messages.map((m, i) => (
              <div
                key={i}
                className={
                  "bubble " +
                  (m.role === "user" ? "bubble-user" : "bubble-model")
                }
              >
                {m.content}
                <div className="bubble-meta">
                  {m.role === "user" ? "You" : "AI"}
                </div>
              </div>
            ))}
        </div>

        {/* COMPOSER */}
        {selectedChat && (
          <div className="composer">
            <div className="composer-inner">
              <div className="composer-row">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write a message..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                />

                <input
                  type="file"
                  id="upload-file"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />

                <button
                  className="btn btn-sm"
                  onClick={() => document.getElementById("upload-file").click()}
                >
                  📎
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  disabled={sending}
                  onClick={sendMessage}
                >
                  {sending ? <LoadingDots /> : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <Modal
          title="Settings"
          subtitle="Global system configuration"
          onClose={() => setShowSettingsModal(false)}
        >
          <SettingsForm
            settings={settings}
            onSave={saveSettings}
          />
        </Modal>
      )}

      {/* NEW CHAT MODAL */}
      {showNewChatModal && (
        <Modal
          title="New Chat"
          subtitle="Give your chat a title"
          onClose={() => setShowNewChatModal(false)}
        >
          <div className="modal-field">
            <label>Chat Title</label>
            <input
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder="Untitled chat"
            />
          </div>

          <button className="btn btn-primary" onClick={createChat}>
            Create Chat
          </button>
        </Modal>
      )}
    </div>
  );
}

// ======================================================================
//  SETTINGS FORM COMPONENT
// ======================================================================

function SettingsForm({ settings, onSave }) {
  const [geminiKey, setGeminiKey] = useState("");
  const [pyKey, setPyKey] = useState("");

  async function save() {
    await onSave({
      geminiApiKey: geminiKey || undefined,
      pythonAnywhereKey: pyKey || undefined,
    });
  }

  return (
    <>
      <div className="modal-field">
        <label>Gemini API Key</label>
        <input
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder={
            settings?.geminiApiKeySet ? "•••••• (already set)" : "Enter API key"
          }
        />
      </div>

      <div className="modal-field">
        <label>PythonAnywhere API Key (optional)</label>
        <input
          value={pyKey}
          onChange={(e) => setPyKey(e.target.value)}
          placeholder={
            settings?.pythonAnywhereKeySet ? "•••••• (already set)" : "Enter API key"
          }
        />
      </div>

      <div style={{ textAlign: "right" }}>
        <button className="btn btn-primary" onClick={save}>
          Save Settings
        </button>
      </div>
    </>
  );
}
