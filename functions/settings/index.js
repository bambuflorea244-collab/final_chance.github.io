// ============================================================================
//  /api/settings
//  GET  - fetch global settings flags (never returns the real keys)
//  POST - update API keys
// ============================================================================

import {
  createContext,
  requireAuth,
  sqlOne,
  sql,
  json,
  error,
} from "../../_utils.js";

export async function onRequestGet({ request, env }) {
  const ctx = createContext(env);

  // Auth check
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const settings = await sqlOne(
    ctx.db,
    `SELECT gemini_api_key, pythonanywhere_key FROM settings WHERE id = 1`
  );

  return json({
    geminiApiKeySet: !!settings?.gemini_api_key,
    pythonAnywhereKeySet: !!settings?.pythonanywhere_key,
  });
}

export async function onRequestPost({ request, env }) {
  const ctx = createContext(env);

  // Auth check
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON", 400);
  }

  const { geminiApiKey, pythonAnywhereKey } = body;

  await sql(
    ctx.db,
    `
    UPDATE settings
    SET
      gemini_api_key = COALESCE(?, gemini_api_key),
      pythonanywhere_key = COALESCE(?, pythonanywhere_key)
    WHERE id = 1
  `,
    [geminiApiKey || null, pythonAnywhereKey || null]
  );

  return json({ ok: true });
}
