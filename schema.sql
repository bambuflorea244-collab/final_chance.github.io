-- ============================================================
--  D1 DATABASE SCHEMA FOR VLAD'S PRIVATE AI
--  Supports: folders, subfolders, chats, per-chat API keys,
--  persistent memory, attachments.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
--  FOLDERS (supports 1-level nesting)
-- ============================================================

CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,  -- null = top-level folder
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- ============================================================
--  CHATS
-- ============================================================

CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    folder_id INTEGER,  -- can be null (no folder)
    system_prompt TEXT, -- optional system instruction
    chat_api_key TEXT,  -- new: per-chat private API key
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- ============================================================
--  MESSAGES (persistent memory)
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- ============================================================
--  ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    r2_key TEXT NOT NULL, -- the key stored inside R2
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- ============================================================
--  GLOBAL SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    gemini_api_key TEXT,
    pythonanywhere_key TEXT
);

-- Ensure exactly 1 settings row exists
INSERT OR IGNORE INTO settings (id) VALUES (1);
