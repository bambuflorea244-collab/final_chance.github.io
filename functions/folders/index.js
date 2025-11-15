// ============================================================================
//  /api/folders
//  GET  - list folders (top-level + subfolders)
//  POST - create folder or subfolder
// ============================================================================

import {
  createContext,
  requireAuth,
  sql,
  json,
  error,
} from "../../_utils.js";

export async function onRequestGet({ request, env }) {
  const ctx = createContext(env);

  // Require Bearer auth
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  // Fetch all folders
  const rows = await sql(
    ctx.db,
    `
    SELECT id, name, parent_id, created_at
    FROM folders
    ORDER BY parent_id IS NOT NULL, name ASC
    `
  );

  return json(rows);
}

export async function onRequestPost({ request, env }) {
  const ctx = createContext(env);

  // Require Bearer auth
  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON", 400);
  }

  const name = (body?.name || "").trim();
  const parentId = body?.parentId ?? null;

  if (!name) return error("Folder name required");

  // Create folder (supports subfolder if parentId is provided)
  const result = await sql(
    ctx.db,
    `
    INSERT INTO folders (name, parent_id)
    VALUES (?, ?)
    `,
    [name, parentId]
  );

  const id = result.lastInsertRowId ?? null;

  return json({ id, name, parentId });
}
