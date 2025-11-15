// ======================================================================
//  Vlad's Private AI — Full Updated React App
//  (Dark Royal Theme, Folder Tree, API Keys, Improved Backend Integration)
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

// Theme Colors
const COLORS = {
  bg: "#120016",
  panel: "#0c0010",
  purple: "#5A189A",
  orange: "#FF8C00",
  red: "#C1121F",
  black: "#000000",
};

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
      <div className="modal" style={{ background: COLORS.panel }}>
        <div className="modal-title" style={{ color: COLORS.orange }}>
          {title}
        </div>
        <div className="modal-subtitle" style={{ color: COLORS.red }}>
          {subtitle}
        </div>
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
    <div
      className="lock-screen"
      style={{ background: COLORS.bg, color: COLORS.orange }}
    >
      <div className="lock-card" style={{ background: COLORS.panel }}>
        <h2 style={{ marginTop: 0, color: COLORS.orange }}>
          🔒 Vlad's Private AI
        </h2>

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

        <button
          className="btn btn-primary"
          style={{ background: COLORS.purple }}
          onClick={login}
        >
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

  // Folders + Subfolders
  const [folders, setFolders] = useState([]);

  // Chats + Selected chat
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);

  // Messages
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

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
  //  LOAD INITIAL DATA
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
    if (authenticated) loadInitialData();
  }, [authenticated]);

  // ====================================================================
  //  SELECT CHAT
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
      await messagesApi.send(selectedChat.id, text);
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
      const folderId =
        selectedChat?.folder_id ||
        folders[0]?.id ||
        null;

      const chat = await chatsApi.create(newChatTitle || "Untitled chat", folderId);
      setChats([chat, ...chats]);
      setShowNewChatModal(false);
      setNewChatTitle("");
      openChat(chat);
    } catch (err) {
      alert("Failed to create chat:\n" + err.message);
    }
  }

  // ====================================================================
  //  SAVE SETTINGS
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
    <div className="app-shell" style={{ background: COLORS.bg, color: "#fff" }}>
      {/* SIDEBAR */}
      <div className="sidebar" style={{ background: COLORS.panel }}>

        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-title" style={{ color: COLORS.orange }}>
              Vlad's Private AI
            </div>
            <div className="brand-subtitle" style={{ color: COLORS.red }}>
              Self-Hosted Console
            </div>
          </div>
          <div className="chip" style={{ background: COLORS.purple }}>Pro</div>
        </div>

        {/* Folder Button */}
        <button
          className="btn btn-primary"
          style={{ background: COLORS.purple }}
          onClick={() => {
            const name = prompt("Folder name:");
            if (!name) return;
            foldersApi.create(name, null).then(() => loadInitialData());
          }}
        >
          + Folder
        </button>

        {/* New Chat */}
        <button
          className="btn btn-primary"
          style={{ background: COLORS.orange, marginTop: "8px" }}
          onClick={() => setShowNewChatModal(true)}
        >
          + New Chat
        </button>

        {/* FOLDER TREE */}
        <div className="folder-tree">
          {folders
            .filter((f) => !f.parent_id)
            .map((folder) => (
              <div key={folder.id} className="folder-block">

                <div className="folder-row">
                  <span className="folder-name">{folder.name}</span>

                  <div>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        const newName = prompt("Rename folder:", folder.name);
                        if (!newName) return;
                        await foldersApi.rename(folder.id, newName);
                        loadInitialData();
                      }}
                    >
                      ✎
                    </button>

                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        if (!confirm("Delete folder and all inside it?")) return;
                        await foldersApi.delete(folder.id);
                        loadInitialData();
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* SUBFOLDERS */}
                <div className="subfolder-area">
                  {folders
                    .filter((sf) => sf.parent_id === folder.id)
                    .map((sf) => (
                      <div key={sf.id} className="subfolder-block">
                        <div className="subfolder-row">
                          📁 <span className="subfolder-name">{sf.name}</span>

                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              const newName = prompt("Rename subfolder:", sf.name);
                              if (!newName) return;
                              foldersApi.rename(sf.id, newName).then(loadInitialData);
                            }}
                          >
                            ✎
                          </button>

                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (confirm("Delete this subfolder?"))
                                foldersApi.delete(sf.id).then(loadInitialData);
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Chats inside subfolder */}
                        <div className="chat-list">
                          {chats
                            .filter((c) => c.folder_id === sf.id)
                            .map((c) => (
                              <button
                                key={c.id}
                                className={
                                  "chat-item " +
                                  (selectedChat?.id === c.id ? "active" : "")
                                }
                                onClick={() => openChat(c)}
                              >
                                💬 {c.title}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}

                  {/* Chats in main folder */}
                  <div className="chat-list">
                    {chats
                      .filter((c) => c.folder_id === folder.id)
                      .map((c) => (
                        <button
                          key={c.id}
                          className={
                            "chat-item " +
                            (selectedChat?.id === c.id ? "active" : "")
                          }
                          onClick={() => openChat(c)}
                        >
                          💬 {c.title}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* FOOTER */}
        <div className="sidebar-footer">
          <button
            className="btn btn-sm"
            style={{ background: COLORS.black }}
            onClick={() => setShowSettingsModal(true)}
          >
            ⚙ Settings
          </button>

          <button
            className="btn btn-sm"
            style={{ background: COLORS.red }}
            onClick={logout}
          >
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

              {/* Chat API key */}
              {selectedChat.chat_api_key && (
                <div className="chat-key">
                  API Key:
                  <span style={{ color: COLORS.orange, marginLeft: "6px" }}>
                    {selectedChat.chat_api_key}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="main-title">Select a chat</div>
          )}
        </div>

        {/* MESSAGES */}
        <div className="messages">
          {!selectedChat && (
            <div className="empty-state">Create or select a chat.</div>
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
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
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
          subtitle="Global configuration"
          onClose={() => setShowSettingsModal(false)}
        >
          <SettingsForm settings={settings} onSave={saveSettings} />
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
            settings?.geminiApiKeySet
              ? "•••••• (already set)"
              : "Enter API key"
          }
        />
      </div>

      <div className="modal-field">
        <label>PythonAnywhere API Key (optional)</label>
        <input
          value={pyKey}
          onChange={(e) => setPyKey(e.target.value)}
          placeholder={
            settings?.pythonAnywhereKeySet
              ? "•••••• (already set)"
              : "Enter API key"
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
