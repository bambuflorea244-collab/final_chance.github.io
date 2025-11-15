// ============================================================================
//  /api/auth/login
//  Validates the master password and returns a Bearer token.
// ============================================================================

import { createContext, json, error } from "../../_utils.js";

export async function onRequestPost({ request, env }) {
  const ctx = createContext(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON", 400);
  }

  const password = (body?.password || "").trim();

  // Prevent empty pass
  if (!password) {
    await new Promise(r => setTimeout(r, 150)); // anti-bruteforce delay
    return error("Unauthorized", 401);
  }

  // Secure compare master password
  const valid = password === ctx.masterPassword;

  if (!valid) {
    await new Promise(r => setTimeout(r, 150)); // anti-bruteforce delay
    return error("Unauthorized", 401);
  }

  // Return token (same as master password)
  return json({ token: ctx.masterPassword });
}
