// ============================================================================
//  /api/auth/check
//  Verifies the Bearer token without returning sensitive data.
// ============================================================================

import { createContext, requireAuth, json } from "../../_utils.js";

export async function onRequestGet({ request, env }) {
  const ctx = createContext(env);

  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  return json({ ok: true });
}
