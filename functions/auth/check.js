// ======================================================================
//  /auth/check.js — Validate session token
//  Ensures the Authorization token is valid.
// ======================================================================

import { requireAuth } from "../_utils.js";

export async function onRequestGet(context) {
  const { env, request } = context;

  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  return Response.json({ ok: true });
}
