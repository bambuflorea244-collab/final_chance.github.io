// ======================================================================
//  /chats/[id]/external.js — External API endpoint for a single chat
//  Uses per-chat API key instead of authentication.
// ======================================================================

import {
  getSetting,
  getAttachmentsMeta,
  arrayBufferToBase64
} from "../../_utils.js";

const MODEL = "gemini-2.5-flash";

// ---------------------- LOAD MESSAGES ----------------------
async function getMessages(env, chatId, limit = 40) {
  const { results } = await env.DB.prepare(
    `SELECT role, content, created_at
     FROM messages
     WHERE chat_id=?
     ORDER BY created_at ASC
     LIMIT ?`
  )
    .bind(chatId, limit)
    .all();

  return results || [];
}

// ---------------------- SAVE A MESSAGE ----------------------
async function storeMessage(env, chatId, role, content) {
  await env.DB.prepare(
    "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
  )
    .bind(chatId, role, content)
    .run();
}

// ---------------------- INLINE EXISTING ATTACHMENTS ----------------------
async function buildAttachmentParts(env, chatId) {
  const attachments = await getAttachmentsMeta(env, chatId);
  const parts = [];

  const images = attachments
    .filter(a => a.mime_type.startsWith("image/"))
    .slice(0, 3);

  for (const img of images) {
    try {
      const object = await env.FILES.get(img.r2_key);
      if (!object) continue;

      const buffer = await object.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      parts.push({
        role: "user",
        parts: [
          { text: `Previously attached image: ${img.name}` },
          {
            inlineData: {
              mimeType: img.mime_type,
              data: base64
            }
          }
        ]
      });
    } catch (err) {
      console.error("Error loading R2 object", img.r2_key, err);
    }
  }

  const others = attachments.filter(a => !a.mime_type.startsWith("image/"));
  if (others.length) {
    const desc = others
      .map(a => `${a.name} (${a.mime_type})`)
      .join(", ");

    parts.push({
      role: "user",
      parts: [
        {
          text:
            "Previously attached non-image files for this chat: " + desc
        }
      ]
    });
  }

  return parts;
}

// ---------------------- SAVE NEW API ATTACHMENTS ----------------------
async function saveNewAttachments(env, chatId, attachmentsPayload) {
  if (!Array.isArray(attachmentsPayload)) return [];

  const saved = [];

  for (const item of attachmentsPayload) {
    const filename = (item.filename || "file").toString();
    const mime = (item.mime || "application/octet-stream").toString();
    const base64 = (item.base64 || "").toString();

    if (!base64) continue;

    const key = `${chatId}/api-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}-${filename}`;

    const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    await env.FILES.put(key, buffer);

    await env.DB.prepare(
      "INSERT INTO attachments (chat_id, name, mime_type, r2_key) VALUES (?, ?, ?, ?)"
    )
      .bind(chatId, filename, mime, key)
      .run();

    saved.push({ filename, mime, key });
  }

  return saved;
}

// ---------------------- MAIN EXTERNAL API HANDLER ----------------------
export async function onRequestPost(context) {
  const { env, request, params } = context;
  const chatId = params.id;

  try {
    // Load chat + API key
    const chat = await env.DB.prepare(
      "SELECT id, api_key, system_prompt FROM chats WHERE id=?"
    )
      .bind(chatId)
      .first();

    if (!chat || !chat.api_key) {
      return new Response("Chat or API key not found", { status: 404 });
    }

    // Authenticate using X-CHAT-API-KEY
    const providedKey =
      request.headers.get("X-CHAT-API-KEY") ||
      request.headers.get("x-chat-api-key") ||
      "";

    if (providedKey !== chat.api_key) {
      return new Response("Invalid API key", { status: 401 });
    }

    // Parse request
    const body = await request.json();
    const message = (body.message || "").toString();
    const attachments = body.attachments || [];

    if (!message) {
      return new Response("Message is required", { status: 400 });
    }

    // Save new attachments sent via API
    await saveNewAttachments(env, chatId, attachments);

    // Load history
    const history = await getMessages(env, chatId);

    const contents = history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // Add existing attachments
    const attachmentParts = await buildAttachmentParts(env, chatId);
    contents.push(...attachmentParts);

    // Add system prompt at beginning
    if (chat.system_prompt) {
      contents.unshift({
        role: "system",
        parts: [{ text: chat.system_prompt }]
      });
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Save user message in DB
    await storeMessage(env, chatId, "user", message);

    // Load Gemini API key
    const apiKey = await getSetting(env, "gemini_api_key");
    if (!apiKey) {
      return new Response(
        "Gemini API key not set. Configure it in the UI.",
        { status: 500 }
      );
    }

    // Call Gemini
    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({ model: MODEL, contents })
      }
    );

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("Gemini error", text);
      return new Response("Gemini API error: " + text, { status: 500 });
    }

    const data = await aiResp.json();

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("\n") || "";

    // Save model reply
    await storeMessage(env, chatId, "model", reply);

    return Response.json({ reply });
  } catch (err) {
    console.error("External chat error:", err);
    return new Response("Failed to process external request", {
      status: 500
    });
  }
}
