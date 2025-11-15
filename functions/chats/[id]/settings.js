// ======================================================================
//  /chats/[id]/settings.js — Chat settings (title, folder, system prompt, API key)
// ======================================================================

import { requireAuth } from "../../_utils.js";

// Helper to generate a new API key
function generateChatApiKey() {
  return "chat_" + crypto.randomUUID().replace(/-/g, "");
}

// ---------------------- GET SETTINGS ----------------------
export async function onRequestGet(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const row = await env.DB.prepare(
      `SELECT id, title, folder_id, api_key, system_prompt, created_at
       FROM chats WHERE id=?`
    )
      .bind(chatId)
      .first();

    if (!row) {
      return new Response("Chat not found", { status: 404 });
    }

    return Response.json(row);
  } catch (err) {
    console.error("GET /chat-settings error:", err);
    return new Response("Failed to load chat settings", { status: 500 });
  }
}

// ---------------------- UPDATE SETTINGS ----------------------
export async function onRequestPost(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const body = await request.json();

    const updates = [];
    const values = [];

    // Title
    if (typeof body.title === "string") {
      updates.push("title=?");
      values.push(body.title.trim() || "Untitled chat");
    }

    // Folder
    if ("folderId" in body) {
      updates.push("folder_id=?");
      values.push(body.folderId || null);
    }

    // System prompt
    if (typeof body.systemPrompt === "string") {
      updates.push("system_prompt=?");
      values.push(body.systemPrompt.trim() || null);
    }

    // Regenerate chat API key
    if (body.regenerateApiKey === true) {
      updates.push("api_key=?");
      values.push(generateChatApiKey());
    }

    // Nothing to update?
    if (updates.length === 0) {
      return new Response("Nothing to update", { status: 400 });
    }

    // Final value is chatId for WHERE
    values.push(chatId);

    // Update database
    await env.DB.prepare(
      `UPDATE chats SET ${updates.join(", ")} WHERE id=?`
    )
      .bind(...values)
      .run();

    // Return updated settings
    const row = await env.DB.prepare(
      `SELECT id, title, folder_id, api_key, system_prompt, created_at
       FROM chats WHERE id=?`
    )
      .bind(chatId)
      .first();

    return Response.json(row);
  } catch (err) {
    console.error("POST /chat-settings error:", err);
    return new Response("Failed to update chat settings", { status: 500 });
  }
}
