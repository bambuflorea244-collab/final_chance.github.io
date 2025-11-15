// ============================================================================
//  /api/chats/:id/messages
//  Handles retrieving + sending messages for a chat
// ============================================================================

import { createContext, requireAuth, json, error } from "../../_utils.js";

// Used for model call — Gemini 2.0 Flash
const MODEL = "gemini-2.0-flash";

// ============================================================================
//  GET → List all messages in a chat
// ============================================================================

export async function onRequestGet({ request, env, params }) {
  const ctx = createContext(env);

  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const chatId = Number(params.chatId);
  if (!chatId) return error("Invalid chat ID", 400);

  try {
    const { results } = await ctx.DB.prepare(
      `SELECT id, chat_id, role, content, created_at
       FROM messages
       WHERE chat_id = ?
       ORDER BY id ASC`
    )
      .bind(chatId)
      .all();

    return json(results);
  } catch (err) {
    return error("Failed loading messages: " + err.message, 500);
  }
}

// ============================================================================
//  POST → Send a message (user → model) and save reply
// ============================================================================

export async function onRequestPost({ request, env, params }) {
  const ctx = createContext(env);
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const chatId = Number(params.chatId);
  if (!chatId) return error("Invalid chat ID", 400);

  let body;
  try {
    body = await readRequestBody(request);
  } catch {
    return error("Invalid JSON body", 400);
  }

  const userMessage = (body.message || "").trim();
  if (!userMessage) return error("Message cannot be empty", 400);

  // ========================================================================
  // 1) Load system prompt + settings for this chat
  // ========================================================================
  const settings = await ctx.DB.prepare(
    `SELECT api_key, system_prompt
     FROM chat_settings
     WHERE chat_id = ?`
  )
    .bind(chatId)
    .first();

  if (!settings) return error("Chat settings not found", 404);

  const { api_key: apiKey, system_prompt: systemPrompt } = settings;

  // ========================================================================
  // 2) Insert USER message into DB
  // ========================================================================
  await ctx.DB.prepare(
    `INSERT INTO messages (chat_id, role, content, created_at)
     VALUES (?, 'user', ?, ?)`
  )
    .bind(chatId, userMessage, Date.now())
    .run();

  // ========================================================================
  // 3) Build conversation history → model input
  // ========================================================================
  const { results: history } = await ctx.DB.prepare(
    `SELECT role, content
     FROM messages
     WHERE chat_id = ?
     ORDER BY id ASC`
  )
    .bind(chatId)
    .all();

  // ========================================================================
  // 4) Build messages for Gemini model
  // ========================================================================
  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: "user",
      content: `SYSTEM PROMPT:\n${systemPrompt}`
    });
  }

  for (const m of history) {
    messages.push({
      role: m.role,
      content: m.content
    });
  }

  // ========================================================================
  // 5) Call Gemini Model via Cloudflare's AI Gateway
  // ========================================================================

  let aiResponseText = "";

  try {
    const aiResponse = await ctx.AI.run(MODEL, {
      messages: messages
    });

    if (!aiResponse || !aiResponse.output_text) {
      throw new Error("Invalid model response");
    }

    aiResponseText = aiResponse.output_text.trim();
  } catch (err) {
    // Still save an error reply so UI shows something meaningful
    aiResponseText = "⚠️ AI Error: " + err.message;
  }

  // ========================================================================
  // 6) Save AI message to DB
  // ========================================================================
  await ctx.DB.prepare(
    `INSERT INTO messages (chat_id, role, content, created_at)
     VALUES (?, 'assistant', ?, ?)`
  )
    .bind(chatId, aiResponseText, Date.now())
    .run();

  return json({
    ok: true,
    reply: aiResponseText
  });
}
