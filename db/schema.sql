CREATE TABLE polls (
    id TEXT PRIMARY KEY,            -- UUID
    title TEXT NOT NULL,
    description TEXT,
    user_id TEXT,                   -- Optional
    created_at TEXT NOT NULL,       -- ISO timestamp
    expires_at TEXT,                -- Optional ISO timestamp
    is_active INTEGER NOT NULL      -- 0 = false, 1 = true
);

CREATE TABLE poll_options (
    id TEXT PRIMARY KEY,            -- UUID
    poll_id TEXT NOT NULL,
    text TEXT NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE votes (
    id TEXT PRIMARY KEY,            -- UUID (idempotency key)
    poll_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    user_id TEXT,                   -- Optional
    created_at TEXT NOT NULL,       -- ISO timestamp
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_votes_poll ON votes(poll_id);
CREATE INDEX idx_votes_option ON votes(option_id);
CREATE INDEX idx_poll_options_poll ON poll_options(poll_id);
