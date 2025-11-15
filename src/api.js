// ======================================================================
//  src/api.js — Frontend API Client for Cloudflare Gemini Console (FIXED)
// ======================================================================

// ---------------------- TOKEN HANDLING ----------------------
let authToken = localStorage.getItem("auth_token") || null;

export function setAuthToken(token) {
  authToken = token;
  localStorage.setItem("auth_token", token);
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem("auth_token");
}

// ---------------------- INTERNAL REQUEST WRAPPER ----------------------
async function request(method, url, data, isForm = false) {
  const headers = {};

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (!isForm) {
    headers["Content-Type"] = "application/json";
  }

  const options = {
    method,
    headers,
  };

  if (method !== "GET") {
    options.body = isForm ? data : JSON.stringify(data || {});
  }

  const resp = await fetch(url, options);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "API Error");
  }

  const contentType = resp.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return resp.json();
  }
  return resp.text();
}

// Simple helpers
export const api = {
  get: (url) => request("GET", url),
  post: (url, data) => request("POST", url, data),
  patch: (url, data) => request("PATCH", url, data),
  delete: (url) => request("DELETE", url),
  upload: (url, formData) => request("POST", url, formData, true),
};

// =====================================================================
//  AUTH
// =====================================================================

export const authApi = {
  login(password) {
    return api.post("/api/auth/login", { password });
  },
  check() {
    return api.get("/api/auth/check");
  },
};

// =====================================================================
//  SETTINGS
// =====================================================================

export const settingsApi = {
  get() {
    return api.get("/api/settings");
  },
  save(body) {
    return api.post("/api/settings", body);
  },
};

// =====================================================================
//  FOLDERS  (SAFE RETURN ARRAYS)
// =====================================================================

export const foldersApi = {
  list() {
    return api.get("/api/folders").then((r) => (Array.isArray(r) ? r : []));
  },
  create(name, parentId = null) {
    return api.post("/api/folders", { name, parentId });
  },
  rename(id, name) {
    return api.patch(`/api/folders/${id}`, { name });
  },
  delete(id) {
    return api.delete(`/api/folders/${id}`);
  },
};

// =====================================================================
//  CHATS  (SAFE RETURN ARRAYS)
// =====================================================================

export const chatsApi = {
  list() {
    return api.get("/api/chats").then((r) => (Array.isArray(r) ? r : []));
  },
  create(title = "Untitled chat", folderId = null, systemPrompt = null) {
    return api.post("/api/chats", {
      title,
      folderId,
      systemPrompt,
    });
  },
  getSettings(id) {
    return api.get(`/api/chats/${id}/settings`);
  },
  updateSettings(id, body) {
    return api.post(`/api/chats/${id}/settings`, body);
  },
  delete(id) {
    return api.post(`/api/chats/${id}/delete`);
  },
};

// =====================================================================
//  MESSAGES  (SAFE RETURN ARRAYS)
// =====================================================================

export const messagesApi = {
  list(chatId) {
    return api
      .get(`/api/chats/${chatId}/messages`)
      .then((r) => (Array.isArray(r) ? r : []));
  },
  send(chatId, message) {
    return api.post(`/api/chats/${chatId}/messages`, { message });
  },
};

// =====================================================================
//  ATTACHMENTS  (SAFE RETURN ARRAYS)
// =====================================================================

export const attachmentsApi = {
  list(chatId) {
    return api
      .get(`/api/chats/${chatId}/attachments`)
      .then((r) => (Array.isArray(r) ? r : []));
  },
  upload(chatId, file) {
    const form = new FormData();
    form.append("file", file);
    return api.upload(`/api/chats/${chatId}/attachments`, form);
  },
};

// =====================================================================
//  EXTERNAL CHAT API
// =====================================================================

export async function externalChatSend(
  chatApiKey,
  chatId,
  message,
  attachments = []
) {
  const resp = await fetch(`/api/chats/${chatId}/external`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CHAT-API-KEY": chatApiKey,
    },
    body: JSON.stringify({ message, attachments }),
  });

  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  return resp.json();
}
