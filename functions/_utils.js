// ============================================================================
//  functions/_utils.js  — Core backend utilities for Vlad's Private AI
// ============================================================================

// DB + R2 bindings come from wrangler.toml
export function createContext(env) {
  return {
    db: env.DB,
    files: env.FILES,
    masterPassword: env.MASTER_PASSWORD,
  };
}

// ============================================================================
//  SQL helpers
// ============================================================================

export async function sql(db, query, params = []) {
  const result = await db.prepare(query).bind(...params).all();
  if (result.error) throw new Error(result.error);
  return result.results;
}

export async function sqlOne(db, query, params = []) {
  const result = await db.prepare(query).bind(...params).first();
  return result || null;
}

// ============================================================================
//  JSON helpers
// ============================================================================

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

// ============================================================================
//  Auth
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
//  R2 Storage helpers
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
//  Chat API Keys
// ============================================================================

export function generateKey() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
//  NEW REQUIRED UTILITIES
// ============================================================================

// Convert ArrayBuffer → Base64
export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Extract metadata for attachments from DB results
export function getAttachmentsMeta(rows) {
  return rows.map(r => ({
    id: r.id,
    filename: r.filename,
    mimetype: r.mimetype,
    size: r.size,
    key: r.r2_key
  }));
}

// Load single setting value (for “external API mode” etc.)
export async function getSetting(db, key) {
  const row = await sqlOne(
    db,
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return row ? row.value : null;
}
