-- Your repos: the public repos each user owns, with upkeep facts and charted star history.
-- Repo metadata itself lives in `repos` (shared), so the daily cron snapshots these too.
CREATE TABLE own_repos (
  user_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  upkeep TEXT NOT NULL DEFAULT '{}',   -- JSON Upkeep
  history TEXT,                        -- JSON [[unix ms, cumulative stars], ...], null until charted
  exact_since INTEGER,                 -- history is exact from this time (ms); sampled before
  recent TEXT NOT NULL DEFAULT '[]',   -- JSON Stargazer[], newest first
  charted_at TEXT,
  sync_run TEXT,
  PRIMARY KEY (user_id, repo_id)
);
CREATE INDEX own_repos_repo ON own_repos(repo_id);

ALTER TABLE users ADD COLUMN own_synced_at TEXT;
