// ============================================================================
//  functions/_utils.js  — Core backend utilities for Vlad's Private AI
// ============================================================================

// DB + R2 bindings come from wrangler.toml
// Example bindings:
//   DB = D1 database
//   FILES = R2 bucket
//   MASTER_PASSWORD as a secret

export function createContext(env) {
  return {
    db: env.DB,
    files: env.FILES,
    masterPassword: env.MASTER_PASSWORD,
  };
}

// ============================================================================
//  SQL helper (auto-throws on errors, returns rows cleanly)
// ============================================================================

export async function sql(db, query, params = []) {
  const result = await db.prepare(query).bind(...params).all();

  if (result.error) {
    console.error("SQL ERROR:", query, params, result.error);
    throw new Error(result.error);
  }
  return result.results;
}

// ============================================================================
//  SQL helper (single row)
// ============================================================================

export async function sqlOne(db, query, params = []) {
  const result = await db.prepare(query).bind(...params).first();

  if (!result) return null;
  return result;
}

// ============================================================================
//  JSON response helpers
// ============================================================================

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

// ============================================================================
//  Require Bearer token authentication
// ============================================================================

export function requireAuth(request, ctx) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { ok: false, res: error("Unauthorized", 401) };
  }

  const token = auth.substring(7).trim();
  if (token !== ctx.masterPassword) {
    return { ok: false, res: error("Unauthorized", 401) };
  }

  return { ok: true };
}

// ============================================================================
//  Handle file uploads (R2 storage)
// ============================================================================

export async function saveFileToR2(r2, key, fileBlob) {
  await r2.put(key, fileBlob);
  return key;
}

export async function getFileFromR2(r2, key) {
  const obj = await r2.get(key);
  if (!obj) return null;
  return obj.body;
}

export async function deleteFileFromR2(r2, key) {
  await r2.delete(key);
}

// ============================================================================
//  Generate random API keys for chats
// ============================================================================

export function generateKey() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

