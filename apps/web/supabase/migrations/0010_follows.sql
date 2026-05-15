-- =========================================================================
-- Follows: user-to-user and user-to-expedition follow relationships
-- =========================================================================

CREATE TABLE user_follows (
  follower_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_user_follows_following ON user_follows (following_id);
CREATE INDEX idx_user_follows_follower  ON user_follows (follower_id);

CREATE TABLE expedition_follows (
  user_id        UUID NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  expedition_id  UUID NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, expedition_id)
);

CREATE INDEX idx_expedition_follows_user       ON expedition_follows (user_id);
CREATE INDEX idx_expedition_follows_expedition ON expedition_follows (expedition_id);

-- =========================================================================
-- Row-Level Security
-- =========================================================================
ALTER TABLE user_follows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedition_follows ENABLE ROW LEVEL SECURITY;

-- user_follows: world-readable, self-managed
CREATE POLICY "user_follows_read"   ON user_follows FOR SELECT USING (true);
CREATE POLICY "user_follows_insert" ON user_follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "user_follows_delete" ON user_follows FOR DELETE USING (follower_id = auth.uid());

-- expedition_follows: world-readable, self-managed
CREATE POLICY "expedition_follows_read"   ON expedition_follows FOR SELECT USING (true);
CREATE POLICY "expedition_follows_insert" ON expedition_follows FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "expedition_follows_delete" ON expedition_follows FOR DELETE USING (user_id = auth.uid());
