// ============================================================================
//  /api/folders/:id
//
//  GET    → get folder details + children (for tree sidebar)
//  PATCH  → rename folder
//  DELETE → delete folder + descendent subfolders + chats
// ============================================================================

import {
  createContext,
  requireAuth,
  sql,
  json,
  error,
} from "../../_utils.js";

export async function onRequestGet({ request, env, params }) {
  const ctx = createContext(env);

  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const id = Number(params.id);
  if (!id) return error("Invalid folder ID", 400);

  // Folder itself
  const folder = await sql(
    ctx.db,
    `SELECT id, name, parent_id, created_at FROM folders WHERE id = ?`,
    [id]
  );

  if (!folder.length) return error("Folder not found", 404);

  // Child folders
  const children = await sql(
    ctx.db,
    `
    SELECT id, name, parent_id, created_at
    FROM folders
    WHERE parent_id = ?
    ORDER BY name ASC
    `,
    [id]
  );

  // Chats inside this folder
  const chats = await sql(
    ctx.db,
    `
    SELECT id, title, created_at
    FROM chats
    WHERE folder_id = ?
    ORDER BY created_at DESC
    `,
    [id]
  );

  return json({
    folder: folder[0],
    subfolders: children,
    chats,
  });
}

export async function onRequestPatch({ request, env, params }) {
  const ctx = createContext(env);

  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const id = Number(params.id);
  if (!id) return error("Invalid folder ID", 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON", 400);
  }

  const newName = (body?.name || "").trim();
  if (!newName) return error("Name is required", 400);

  await sql(
    ctx.db,
    `UPDATE folders SET name = ? WHERE id = ?`,
    [newName, id]
  );

  return json({ id, name: newName });
}

export async function onRequestDelete({ request, env, params }) {
  const ctx = createContext(env);

  const a = requireAuth(request, ctx);
  if (!a.ok) return a.res;

  const id = Number(params.id);
  if (!id) return error("Invalid folder ID", 400);

  // Delete folder + subfolders + their chats (recursive cascade)
  //
  // SQLite recursive CTE allows us to gather all descendents.
  //
  const rows = await sql(
    ctx.db,
    `
    WITH RECURSIVE folder_tree(id) AS (
      SELECT id FROM folders WHERE id = ?
      UNION ALL
      SELECT f.id
      FROM folders f
      JOIN folder_tree ft ON f.parent_id = ft.id
    )
    DELETE FROM folders WHERE id IN (SELECT id FROM folder_tree)
    `,
    [id]
  );

  // Also delete chats referencing this folder (and messages due to ON DELETE CASCADE)
  await sql(
    ctx.db,
    `
    DELETE FROM chats
    WHERE folder_id IN (
      WITH RECURSIVE folder_tree(id) AS (
        SELECT id FROM folders WHERE id = ?
        UNION ALL
        SELECT f.id FROM folders f JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT id FROM folder_tree
    )`,
    [id]
  );

  return json({ deleted: true });
}
