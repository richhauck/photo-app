-- =========================================================================
-- Expeditions — user-generated step-by-step location guides
-- =========================================================================

CREATE TABLE expeditions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  cover_storage_key TEXT,
  like_count        INTEGER NOT NULL DEFAULT 0,
  comment_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

CREATE INDEX idx_expeditions_recent ON expeditions (created_at DESC);

CREATE TABLE expedition_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_id  UUID NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL DEFAULT 0,
  description    TEXT NOT NULL,
  location       geography(Point, 4326),
  location_name  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expedition_steps_order
  ON expedition_steps (expedition_id, position);

CREATE TABLE expedition_likes (
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expedition_id  UUID NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, expedition_id)
);

CREATE INDEX idx_expedition_likes_expedition ON expedition_likes (expedition_id);

CREATE TABLE expedition_comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_id  UUID NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body           TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX idx_expedition_comments
  ON expedition_comments (expedition_id, created_at ASC)
  WHERE deleted_at IS NULL;

-- -------------------------------------------------------------------------
-- Counter triggers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_expedition_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE expeditions SET like_count = like_count + 1 WHERE id = NEW.expedition_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE expeditions SET like_count = like_count - 1 WHERE id = OLD.expedition_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expedition_likes_count
AFTER INSERT OR DELETE ON expedition_likes
FOR EACH ROW EXECUTE FUNCTION bump_expedition_like_count();

CREATE OR REPLACE FUNCTION bump_expedition_comment_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    UPDATE expeditions SET comment_count = comment_count + 1 WHERE id = NEW.expedition_id;
  ELSIF TG_OP = 'DELETE' AND OLD.deleted_at IS NULL THEN
    UPDATE expeditions SET comment_count = comment_count - 1 WHERE id = OLD.expedition_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE expeditions SET comment_count = comment_count - 1 WHERE id = NEW.expedition_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE expeditions SET comment_count = comment_count + 1 WHERE id = NEW.expedition_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expedition_comments_count
AFTER INSERT OR UPDATE OR DELETE ON expedition_comments
FOR EACH ROW EXECUTE FUNCTION bump_expedition_comment_count();

-- -------------------------------------------------------------------------
-- RPC: set PostGIS location on an expedition step the caller owns
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_expedition_step_location(
  p_step_id  UUID,
  p_lng      DOUBLE PRECISION,
  p_lat      DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE expedition_steps
     SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
   WHERE id = p_step_id
     AND expedition_id IN (
       SELECT id FROM expeditions WHERE owner_id = auth.uid()
     );
END;
$$;

-- =========================================================================
-- Row-Level Security
-- =========================================================================
ALTER TABLE expeditions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedition_steps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedition_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedition_comments ENABLE ROW LEVEL SECURITY;

-- expeditions: publicly readable, owner-writable
CREATE POLICY "expeditions_read"   ON expeditions FOR SELECT USING (true);
CREATE POLICY "expeditions_insert" ON expeditions FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "expeditions_update" ON expeditions FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "expeditions_delete" ON expeditions FOR DELETE USING (owner_id = auth.uid());

-- expedition_steps: readable with expedition, writable by expedition owner
CREATE POLICY "expedition_steps_read"
  ON expedition_steps FOR SELECT USING (
    EXISTS (SELECT 1 FROM expeditions e WHERE e.id = expedition_steps.expedition_id)
  );
CREATE POLICY "expedition_steps_write"
  ON expedition_steps FOR ALL USING (
    EXISTS (
      SELECT 1 FROM expeditions e
      WHERE e.id = expedition_steps.expedition_id AND e.owner_id = auth.uid()
    )
  );

-- expedition_likes: readable by all, insert/delete by owner
CREATE POLICY "expedition_likes_read"   ON expedition_likes FOR SELECT USING (true);
CREATE POLICY "expedition_likes_insert" ON expedition_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "expedition_likes_delete" ON expedition_likes FOR DELETE USING (user_id = auth.uid());

-- expedition_comments: readable (non-deleted), insertable by authenticated
CREATE POLICY "expedition_comments_read"
  ON expedition_comments FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM expeditions e WHERE e.id = expedition_comments.expedition_id)
  );
CREATE POLICY "expedition_comments_insert"
  ON expedition_comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "expedition_comments_update"
  ON expedition_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "expedition_comments_delete"
  ON expedition_comments FOR DELETE USING (author_id = auth.uid());
