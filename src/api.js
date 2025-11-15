// ======================================================================
//  src/api.js — Frontend API Client for Vlad's Private AI
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
    headers
  };

  if (method !== "GET") {
    options.body = isForm ? data : JSON.stringify(data || {});
  }

  const resp = await fetch(url, options);

  if (!resp.ok) {
    let txt;
    try {
      txt = await resp.text();
    } catch {
      txt = "API Error";
    }
    throw new Error(txt || "API Error");
  }

  const ct = resp.headers.get("content-type");
  if (ct?.includes("application/json")) {
    return resp.json();
  }

  return resp.text();
}

// Convenience shortcuts
export const api = {
  get: (u) => request("GET", u),
  post: (u, d) => request("POST", u, d),
  patch: (u, d) => request("PATCH", u, d),
  delete: (u) => request("DELETE", u),
  upload: (u, form) => request("POST", u, form, true),
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
  }
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
  }
};

// =====================================================================
//  FOLDERS
// =====================================================================

export const foldersApi = {
  list() {
    return api.get("/api/folders");
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
  get(id) {
    return api.get(`/api/folders/${id}`);
  }
};

// =====================================================================
//  CHATS
// =====================================================================

export const chatsApi = {
  list() {
    return api.get("/api/chats");
  },
  create(title = "Untitled chat", folderId = null, systemPrompt = null) {
    return api.post("/api/chats", {
      title,
      folderId,
      systemPrompt
    });
  },
  get(id) {
    return api.get(`/api/chats/${id}`);
  },
  updateSettings(id, body) {
    return api.post(`/api/chats/${id}/settings`, body);
  },
  delete(id) {
    return api.post(`/api/chats/${id}/delete`);
  }
};

// =====================================================================
//  MESSAGES
// =====================================================================

export const messagesApi = {
  list(chatId) {
    return api.get(`/api/chats/${chatId}/messages`);
  },
  send(chatId, message) {
    return api.post(`/api/chats/${chatId}/messages`, { message });
  }
};

// =====================================================================
//  ATTACHMENTS
// =====================================================================

export const attachmentsApi = {
  list(chatId) {
    return api.get(`/api/chats/${chatId}/attachments`);
  },
  upload(chatId, file) {
    const form = new FormData();
    form.append("file", file);
    return api.upload(`/api/chats/${chatId}/attachments`, form);
  }
};

// =====================================================================
//  EXTERNAL CHAT API (per-chat API key)
// =====================================================================

export async function externalChatSend(chatApiKey, chatId, message, attachments = []) {
  const resp = await fetch(`/api/chats/${chatId}/external`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CHAT-API-KEY": chatApiKey
    },
    body: JSON.stringify({ message, attachments })
  });

  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  return resp.json();
}
