// ======================================================================
//  /chats/[id]/messages.js — Message listing & AI response generation
// ======================================================================

import {
  requireAuth,
  getSetting,
  getAttachmentsMeta,
  arrayBufferToBase64
} from "../../_utils.js";

const MODEL = "gemini-2.5-flash";

// ---------------------- LOAD MESSAGES ----------------------
async function getMessages(env, chatId, limit = 200) {
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

// ---------------------- GET ----------------------
export async function onRequestGet(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const messages = await getMessages(env, chatId);
    return Response.json(messages);
  } catch (err) {
    console.error("GET /messages error:", err);
    return new Response("Failed to load messages", { status: 500 });
  }
}

// ---------------------- BUILD ATTACHMENT PARTS ----------------------
async function buildAttachmentParts(env, chatId) {
  const attachments = await getAttachmentsMeta(env, chatId);
  const parts = [];

  // Inline up to 3 images
  const images = attachments.filter(a => a.mime_type.startsWith("image/")).slice(0, 3);

  for (const img of images) {
    try {
      const object = await env.FILES.get(img.r2_key);
      if (!object) continue;

      const buffer = await object.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      parts.push({
        role: "user",
        parts: [
          { text: `Attached image: ${img.name}` },
          { inlineData: { mimeType: img.mime_type, data: base64 } }
        ]
      });
    } catch (err) {
      console.error("Failed to load R2 object", img.r2_key, err);
    }
  }

  // Include description of other file types
  const others = attachments.filter(a => !a.mime_type.startsWith("image/"));
  if (others.length) {
    parts.push({
      role: "user",
      parts: [
        {
          text:
            "Additional attached files for this chat: " +
            others.map(a => `${a.name} (${a.mime_type})`).join(", ")
        }
      ]
    });
  }

  return parts;
}

// ---------------------- POST ----------------------
export async function onRequestPost(context) {
  const { env, request, params } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;

  try {
    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return new Response("Invalid message", { status: 400 });
    }

    // Save user message
    await env.DB.prepare(
      "INSERT INTO messages (chat_id, role, content) VALUES (?, 'user', ?)"
    )
      .bind(chatId, message)
      .run();

    // Load past history
    const history = await getMessages(env, chatId, 40);
    const historyParts = history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // Add attachment parts
    const attachmentParts = await buildAttachmentParts(env, chatId);

    // Add current user message
    const contents = [
      ...historyParts,
      ...attachmentParts,
      { role: "user", parts: [{ text: message }] }
    ];

    // Get Gemini API key
    const apiKey = await getSetting(env, "gemini_api_key");
    if (!apiKey) {
      return new Response("Gemini API key not set", { status: 500 });
    }

    // Query Gemini
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
      console.error("Gemini API error:", text);
      return new Response("Gemini API error", { status: 500 });
    }

    // Parse reply
    const data = await aiResp.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n") ||
      "[No reply]";

    // Save model reply
    await env.DB.prepare(
      "INSERT INTO messages (chat_id, role, content) VALUES (?, 'model', ?)"
    )
      .bind(chatId, reply)
      .run();

    return Response.json({ reply });
  } catch (err) {
    console.error("POST /messages error:", err);
    return new Response("Failed to send message", { status: 500 });
  }
}
