-- StarTune schema

CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- GitHub node id
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  avatar_url TEXT,
  token_enc TEXT NOT NULL,           -- AES-GCM encrypted GitHub token
  scopes TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,               -- sha-256 of the cookie value
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL        -- unix ms
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Repository metadata, shared across users of one install
CREATE TABLE repos (
  id TEXT PRIMARY KEY,               -- GitHub node id
  full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  homepage TEXT,
  language TEXT,
  language_color TEXT,
  topics TEXT NOT NULL DEFAULT '[]', -- JSON array
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_fork INTEGER NOT NULL DEFAULT 0,
  license TEXT,
  owner_avatar TEXT,
  created_at TEXT,
  pushed_at TEXT,
  latest_release_at TEXT,
  latest_release_tag TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX repos_fetched ON repos(fetched_at);

CREATE TABLE stars (
  user_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  starred_at TEXT NOT NULL,
  reviewed_at TEXT,                  -- "keep" decision in triage
  snoozed_until TEXT,
  sync_run TEXT,                     -- last sync that saw this star
  PRIMARY KEY (user_id, repo_id)
);
CREATE INDEX stars_repo ON stars(repo_id);

CREATE TABLE lists (
  id TEXT PRIMARY KEY,               -- GitHub UserList node id
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_private INTEGER NOT NULL DEFAULT 0,
  sync_run TEXT
);
CREATE INDEX lists_user ON lists(user_id);

CREATE TABLE list_items (
  list_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  PRIMARY KEY (list_id, repo_id)
);
CREATE INDEX list_items_repo ON list_items(repo_id);

-- Daily star counts, used for trending
CREATE TABLE snapshots (
  repo_id TEXT NOT NULL,
  day TEXT NOT NULL,                 -- YYYY-MM-DD (UTC)
  stars INTEGER NOT NULL,
  PRIMARY KEY (repo_id, day)
);

-- Clef suggestions
CREATE TABLE suggestions (
  user_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  list_id TEXT,                      -- null = no list fits
  list_confidence REAL NOT NULL DEFAULT 0,
  cruft REAL NOT NULL DEFAULT 0,     -- probability 0..1
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, repo_id)
);

-- Undo log for unstars
CREATE TABLE unstar_log (
  user_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  starred_at TEXT,
  list_ids TEXT NOT NULL DEFAULT '[]',
  unstarred_at TEXT NOT NULL,
  PRIMARY KEY (user_id, repo_id)
);
