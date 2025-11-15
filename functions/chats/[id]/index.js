// ============================================================================
//  /api/chats/:id
//  GET → Return full chat object including settings
// ============================================================================

import { createContext, requireAuth, json, error } from "../../_utils.js";

export async function onRequestGet({ request, env, params }) {
  const ctx = createContext(env);

  // Authentication check
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const chatId = Number(params.id);
  if (!chatId) return error("Invalid chat ID", 400);

  try {
    // ------------------------------------------------------------
    // Load chat core data
    // ------------------------------------------------------------
    const chat = await ctx.DB.prepare(
      `SELECT id, title, folder_id, created_at, updated_at
       FROM chats
       WHERE id = ?`
    )
      .bind(chatId)
      .first();

    if (!chat) return error("Chat not found", 404);

    // ------------------------------------------------------------
    // Load settings (api key + system prompt)
    // ------------------------------------------------------------
    const settings = await ctx.DB.prepare(
      `SELECT api_key, system_prompt
         FROM chat_settings
        WHERE chat_id = ?`
    )
      .bind(chatId)
      .first();

    // Guarantee fields for UI
    chat.apiKey = settings?.api_key || null;
    chat.systemPrompt = settings?.system_prompt || "";

    return json(chat);
  } catch (err) {
    return error("Failed to load chat: " + err.message, 500);
  }
}
