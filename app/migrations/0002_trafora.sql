CREATE TABLE IF NOT EXISTS trafora_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trafora_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES trafora_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS trafora_sessions_user_idx ON trafora_sessions(user_id);

CREATE TABLE IF NOT EXISTS trafora_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES trafora_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS trafora_campaigns_owner_idx ON trafora_campaigns(owner_id, created_at);

CREATE TABLE IF NOT EXISTS trafora_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES trafora_users(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES trafora_campaigns(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  target_url TEXT NOT NULL,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS trafora_links_owner_idx ON trafora_links(owner_id, created_at);
CREATE INDEX IF NOT EXISTS trafora_links_campaign_idx ON trafora_links(campaign_id);

CREATE TABLE IF NOT EXISTS trafora_click_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL REFERENCES trafora_links(id) ON DELETE CASCADE,
  referrer_host TEXT,
  user_agent TEXT,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS trafora_click_events_link_idx ON trafora_click_events(link_id, clicked_at);
