// ======================================================================
//  /settings/index.js — Global settings
//  Stores Gemini API key + PythonAnywhere key inside D1.
// ======================================================================

import { requireAuth, getSetting, setSetting } from "../_utils.js";

export async function onRequestGet(context) {
  const { env, request } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const geminiKey = await getSetting(env, "gemini_api_key");
  const pythonKey = await getSetting(env, "python_anywhere_key");

  return Response.json({
    geminiApiKeySet: !!geminiKey,
    pythonAnywhereKeySet: !!pythonKey,
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const body = await request.json();

  if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) {
    await setSetting(env, "gemini_api_key", body.geminiApiKey.trim());
  }

  if (typeof body.pythonAnywhereKey === "string" && body.pythonAnywhereKey.trim()) {
    await setSetting(env, "python_anywhere_key", body.pythonAnywhereKey.trim());
  }

  return Response.json({ ok: true });
}
