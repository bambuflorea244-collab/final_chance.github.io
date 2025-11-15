// ============================================================================
//  /api/chats/:id/settings
//  GET  → read chat settings (api key, system prompt)
//  POST → update system prompt OR regenerate API key
// ============================================================================

import {
  createContext,
  requireAuth,
  json,
  error,
  readRequestBody
} from "../../../_utils.js";

// Generate secure chat API keys
function generateChatApiKey() {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
//  GET → Return chat settings
// ============================================================================

export async function onRequestGet({ request, env, params }) {
  const ctx = createContext(env);
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const chatId = Number(params.id);
  if (!chatId) return error("Invalid chat ID", 400);

  try {
    const row = await ctx.DB.prepare(
      `SELECT chat_id, api_key, system_prompt
       FROM chat_settings
       WHERE chat_id = ?`
    )
      .bind(chatId)
      .first();

    if (!row) return error("Chat settings not found", 404);

    return json({
      chatId: row.chat_id,
      apiKey: row.api_key,
      systemPrompt: row.system_prompt || ""
    });
  } catch (err) {
    return error("Failed to load chat settings: " + err.message, 500);
  }
}

// ============================================================================
//  POST → Update system prompt OR regenerate API key
// ============================================================================

export async function onRequestPost({ request, env, params }) {
  const ctx = createContext(env);
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const chatId = Number(params.id);
  if (!chatId) return error("Invalid chat ID", 400);

  let body;
  try {
    body = await readRequestBody(request);
  } catch {
    return error("Invalid JSON", 400);
  }

  const { regenerateKey, systemPrompt } = body;

  // ========================================================================
  // ACTION 1 — Regenerate API Key
  // ========================================================================
  if (regenerateKey === true) {
    try {
      const newKey = generateChatApiKey();

      await ctx.DB.prepare(
        `UPDATE chat_settings
         SET api_key = ?
         WHERE chat_id = ?`
      )
        .bind(newKey, chatId)
        .run();

      return json({
        ok: true,
        apiKey: newKey
      });
    } catch (err) {
      return error("Failed to regenerate API key: " + err.message, 500);
    }
  }

  // ========================================================================
  // ACTION 2 — Update System Prompt
  // ========================================================================
  if (typeof systemPrompt === "string") {
    try {
      await ctx.DB.prepare(
        `UPDATE chat_settings
         SET system_prompt = ?
         WHERE chat_id = ?`
      )
        .bind(systemPrompt.trim(), chatId)
        .run();

      return json({
        ok: true,
        systemPrompt: systemPrompt.trim()
      });
    } catch (err) {
      return error("Failed to update system prompt: " + err.message, 500);
    }
  }

  // ========================================================================
  // No recognized action
  // ========================================================================
  return error("Invalid request", 400);
}
