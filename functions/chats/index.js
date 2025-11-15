// ============================================================================
//  /api/chats
//  Create chat, list chats
// ============================================================================

import { createContext, requireAuth, json, error } from "../../_utils.js";

// Generate secure random API keys per chat
function generateChatApiKey() {
  const rand = crypto.getRandomValues(new Uint8Array(32));
  return [...rand].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
//  GET → List all chats
// ============================================================================

export async function onRequestGet({ request, env }) {
  const ctx = createContext(env);
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  try {
    const { results } = await ctx.DB.prepare(
      `SELECT id, title, folder_id, created_at
       FROM chats
       ORDER BY created_at DESC`
    ).all();

    return json(results);
  } catch (err) {
    return error("Failed to list chats: " + err.message, 500);
  }
}

// ============================================================================
//  POST → Create chat
// ============================================================================

export async function onRequestPost({ request, env }) {
  const ctx = createContext(env);
  const auth = requireAuth(request, ctx);
  if (!auth.ok) return auth.res;

  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON", 400);
  }

  const title = (body.title || "Untitled chat").trim();
  const folderId = body.folderId ?? null;
  const systemPrompt = body.systemPrompt || null;

  const apiKey = generateChatApiKey();
  const createdAt = Date.now();

  try {
    // Insert chat
    const insertChat = await ctx.DB.prepare(
      `INSERT INTO chats (title, folder_id, created_at)
       VALUES (?, ?, ?)`
    )
      .bind(title, folderId, createdAt)
      .run();

    const chatId = insertChat.lastInsertRowId;

    // Insert chat settings (API key, system prompt)
    await ctx.DB.prepare(
      `INSERT INTO chat_settings (chat_id, api_key, system_prompt)
       VALUES (?, ?, ?)`
    )
      .bind(chatId, apiKey, systemPrompt)
      .run();

    // Return full chat object
    return json({
      id: chatId,
      title,
      folderId,
      createdAt,
      apiKey
    });
  } catch (err) {
    return error("Failed to create chat: " + err.message, 500);
  }
}
