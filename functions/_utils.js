// ======================================================================
//  _utils.js — Shared utilities for Cloudflare Pages Functions
//  Fully compatible with D1, R2, and Pages routing.
// ======================================================================

// ---------------------- AUTH CHECK ----------------------
export async function requireAuth(env, request) {
  const header = request.headers.get("Authorization");
  const token = header?.replace("Bearer ", "");

  if (!token) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }

  const row = await env.DB.prepare(
    "SELECT token FROM sessions WHERE token=?"
  )
    .bind(token)
    .first();

  if (!row) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }

  return { ok: true };
}

// ---------------------- SETTINGS ----------------------
export async function getSetting(env, key) {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key=?"
  )
    .bind(key)
    .first();
  return row?.value ?? null;
}

export async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(key, value)
    .run();
}

// ---------------------- ATTACHMENT METADATA ----------------------
export async function getAttachmentsMeta(env, chatId) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, mime_type, r2_key, created_at
     FROM attachments
     WHERE chat_id = ?`
  )
    .bind(chatId)
    .all();

  return results || [];
}

// ---------------------- ARRAYBUFFER → BASE64 ----------------------
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
