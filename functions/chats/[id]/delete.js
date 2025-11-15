// ======================================================================
//  /chats/[id]/delete.js — Delete a chat + messages + attachments + R2 files
// ======================================================================

import { requireAuth, getAttachmentsMeta } from "../../_utils.js";

export async function onRequestPost(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    // Make sure the chat exists
    const chat = await env.DB.prepare(
      "SELECT id FROM chats WHERE id=?"
    )
      .bind(chatId)
      .first();

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    // -------- Delete files from R2 --------
    const attachments = await getAttachmentsMeta(env, chatId);

    for (const a of attachments) {
      try {
        await env.FILES.delete(a.r2_key);
      } catch (err) {
        console.error("Failed to delete R2 object", a.r2_key, err);
      }
    }

    // -------- Delete rows from DB --------

    // Messages
    await env.DB.prepare(
      "DELETE FROM messages WHERE chat_id=?"
    )
      .bind(chatId)
      .run();

    // Attachments
    await env.DB.prepare(
      "DELETE FROM attachments WHERE chat_id=?"
    )
      .bind(chatId)
      .run();

    // Chat
    await env.DB.prepare(
      "DELETE FROM chats WHERE id=?"
    )
      .bind(chatId)
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE chat error:", err);
    return new Response("Failed to delete chat", { status: 500 });
  }
}
