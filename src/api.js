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
    headers,
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
//  AUTH  (NO /api PREFIX)
// =====================================================================

export const authApi = {
  login(password) {
    // was: "/api/auth/login"
    return api.post("/auth/login", { password });
  },
  check() {
    // was: "/api/auth/check"
    return api.get("/auth/check");
  },
};

// =====================================================================
//  SETTINGS
// =====================================================================

export const settingsApi = {
  get() {
    // was: "/api/settings"
    return api.get("/settings");
  },
  save(body) {
    // was: "/api/settings"
    return api.post("/settings", body);
  },
};

// =====================================================================
//  FOLDERS
// =====================================================================

export const foldersApi = {
  list() {
    // was: "/api/folders"
    return api.get("/folders");
  },
  create(name, parentId = null) {
    // was: "/api/folders"
    return api.post("/folders", { name, parentId });
  },
  rename(id, name) {
    // was: `/api/folders/${id}`
    return api.patch(`/folders/${id}`, { name });
  },
  delete(id) {
    // was: `/api/folders/${id}`
    return api.delete(`/folders/${id}`);
  },
  get(id) {
    // was: `/api/folders/${id}`
    return api.get(`/folders/${id}`);
  },
};

// =====================================================================
//  CHATS
// =====================================================================

export const chatsApi = {
  list() {
    // was: "/api/chats"
    return api.get("/chats");
  },
  create(title = "Untitled chat", folderId = null, systemPrompt = null) {
    // was: "/api/chats"
    return api.post("/chats", {
      title,
      folderId,
      systemPrompt,
    });
  },
  get(id) {
    // was: `/api/chats/${id}`
    return api.get(`/chats/${id}`);
  },
  updateSettings(id, body) {
    // was: `/api/chats/${id}/settings`
    return api.post(`/chats/${id}/settings`, body);
  },
  delete(id) {
    // was: `/api/chats/${id}/delete`
    return api.post(`/chats/${id}/delete`);
  },
};

// =====================================================================
//  MESSAGES
// =====================================================================

export const messagesApi = {
  list(chatId) {
    // was: `/api/chats/${chatId}/messages`
    return api.get(`/chats/${chatId}/messages`);
  },
  send(chatId, message) {
    // was: `/api/chats/${chatId}/messages`
    return api.post(`/chats/${chatId}/messages`, { message });
  },
};

// =====================================================================
//  ATTACHMENTS
// =====================================================================

export const attachmentsApi = {
  list(chatId) {
    // was: `/api/chats/${chatId}/attachments`
    return api.get(`/chats/${chatId}/attachments`);
  },
  upload(chatId, file) {
    const form = new FormData();
    form.append("file", file);
    // was: `/api/chats/${chatId}/attachments`
    return api.upload(`/chats/${chatId}/attachments`, form);
  },
};

// =====================================================================
//  EXTERNAL CHAT API (per-chat API key)
// =====================================================================

export async function externalChatSend(
  chatApiKey,
  chatId,
  message,
  attachments = []
) {
  // was: `/api/chats/${chatId}/external`
  const resp = await fetch(`/chats/${chatId}/external`, {
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
