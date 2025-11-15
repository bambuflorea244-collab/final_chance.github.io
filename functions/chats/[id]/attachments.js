// ======================================================================
//  /chats/[id]/attachments.js — Uploading & listing chat attachments
// ======================================================================

import {
  requireAuth,
  getAttachmentsMeta
} from "../../_utils.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

// ---------------------- LIST ATTACHMENTS ----------------------
export async function onRequestGet(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const chat = await env.DB.prepare(
      "SELECT id FROM chats WHERE id=?"
    )
      .bind(chatId)
      .first();

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    const attachments = await getAttachmentsMeta(env, chatId);
    return Response.json(attachments);
  } catch (err) {
    console.error("GET /attachments error:", err);
    return new Response("Failed to fetch attachments", { status: 500 });
  }
}

// ---------------------- UPLOAD ATTACHMENT ----------------------
export async function onRequestPost(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const chat = await env.DB.prepare(
      "SELECT id FROM chats WHERE id=?"
    )
      .bind(chatId)
      .first();

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return new Response("No file uploaded", { status: 400 });
    }

    const size = file.size;
    if (size > MAX_FILE_BYTES) {
      return new Response("File too large (max 15MB)", { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const name = file.name || "file";

    // Generate R2 storage key
    const key = `${chatId}/${Date.now()}-${name}`;

    // Read file buffer
    const buffer = await file.arrayBuffer();

    // Store in R2 bucket
    await env.FILES.put(key, buffer);

    // Insert DB metadata
    await env.DB.prepare(
      "INSERT INTO attachments (chat_id, name, mime_type, r2_key) VALUES (?, ?, ?, ?)"
    )
      .bind(chatId, name, mime, key)
      .run();

    // Retrieve last inserted row ID
    const row = await env.DB.prepare(
      "SELECT last_insert_rowid() AS id"
    ).first();

    return Response.json({
      id: row.id,
      chat_id: chatId,
      name,
      mime_type: mime,
      r2_key: key
    });
  } catch (err) {
    console.error("POST /attachments error:", err);
    return new Response("Failed to upload attachment", { status: 500 });
  }
}
