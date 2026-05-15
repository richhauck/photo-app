-- =========================================================================
-- Photo sharing app — initial schema for Supabase (Postgres 15/16 + PostGIS)
-- Run in Supabase SQL editor or via `supabase db push`.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Extensions (pgcrypto and uuid-ossp are enabled by default on Supabase)
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

-- -------------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE visibility AS ENUM ('public', 'unlisted', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------------------
-- profiles — extends auth.users 1:1
-- -------------------------------------------------------------------------
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      CITEXT UNIQUE NOT NULL,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile row whenever a new auth user signs up.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -------------------------------------------------------------------------
-- Reference data: licenses, categories
-- -------------------------------------------------------------------------
CREATE TABLE licenses (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  url          TEXT,
  description  TEXT
);

INSERT INTO licenses (code, name, url) VALUES
  ('ARR',          'All Rights Reserved',                         NULL),
  ('CC0',          'Creative Commons Zero (Public Domain)',       'https://creativecommons.org/publicdomain/zero/1.0/'),
  ('CC-BY-4.0',    'Creative Commons Attribution 4.0',            'https://creativecommons.org/licenses/by/4.0/'),
  ('CC-BY-SA-4.0', 'Creative Commons Attribution-ShareAlike 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'),
  ('CC-BY-NC-4.0', 'Creative Commons Attribution-NonCommercial 4.0','https://creativecommons.org/licenses/by-nc/4.0/'),
  ('CC-BY-ND-4.0', 'Creative Commons Attribution-NoDerivatives 4.0','https://creativecommons.org/licenses/by-nd/4.0/');

CREATE TABLE categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories (slug, name) VALUES
  ('landscape',  'Landscape'),
  ('portrait',   'Portrait'),
  ('street',     'Street'),
  ('wildlife',   'Wildlife'),
  ('architecture','Architecture'),
  ('macro',      'Macro'),
  ('travel',     'Travel');

-- -------------------------------------------------------------------------
-- Galleries
-- -------------------------------------------------------------------------
CREATE TABLE galleries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_photo_id  UUID,  -- wired after photos is created
  visibility      visibility NOT NULL DEFAULT 'public',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

-- -------------------------------------------------------------------------
-- Photos
-- -------------------------------------------------------------------------
CREATE TABLE photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title             TEXT NOT NULL,
  description       TEXT,
  license_code      TEXT REFERENCES licenses(code),
  visibility        visibility NOT NULL DEFAULT 'public',

  storage_key       TEXT NOT NULL,    -- R2 object key
  mime_type         TEXT NOT NULL,
  width             INTEGER,
  height            INTEGER,
  file_size_bytes   BIGINT,

  taken_at          TIMESTAMPTZ,
  camera_make       TEXT,
  camera_model      TEXT,

  location          geography(Point, 4326),
  location_name     TEXT,

  like_count        INTEGER NOT NULL DEFAULT 0,
  comment_count     INTEGER NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_photos_owner
  ON photos (owner_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_photos_public_recent
  ON photos (created_at DESC)
  WHERE visibility = 'public' AND deleted_at IS NULL;

CREATE INDEX idx_photos_location
  ON photos USING GIST (location)
  WHERE location IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE galleries
  ADD CONSTRAINT fk_gallery_cover
  FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;

CREATE TABLE photo_variants (
  photo_id         UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  variant          TEXT NOT NULL,
  storage_key      TEXT NOT NULL,
  width            INTEGER NOT NULL,
  height           INTEGER NOT NULL,
  mime_type        TEXT NOT NULL,
  file_size_bytes  BIGINT,
  PRIMARY KEY (photo_id, variant)
);

-- -------------------------------------------------------------------------
-- Joins
-- -------------------------------------------------------------------------
CREATE TABLE photo_categories (
  photo_id     UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, category_id)
);
CREATE INDEX idx_photo_categories_category ON photo_categories (category_id);

CREATE TABLE gallery_photos (
  gallery_id  UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  photo_id    UUID NOT NULL REFERENCES photos(id)    ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (gallery_id, photo_id)
);
CREATE INDEX idx_gallery_photos_photo ON gallery_photos (photo_id);
CREATE INDEX idx_gallery_photos_order ON gallery_photos (gallery_id, position);

-- -------------------------------------------------------------------------
-- Comments (threaded) & likes
-- -------------------------------------------------------------------------
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    UUID NOT NULL REFERENCES photos(id)   ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_comments_photo
  ON comments (photo_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE likes (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_id    UUID NOT NULL REFERENCES photos(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, photo_id)
);
CREATE INDEX idx_likes_photo ON likes (photo_id);

-- -------------------------------------------------------------------------
-- Counter triggers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE photos SET like_count = like_count + 1 WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE photos SET like_count = like_count - 1 WHERE id = OLD.photo_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION bump_like_count();

CREATE OR REPLACE FUNCTION bump_comment_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    UPDATE photos SET comment_count = comment_count + 1 WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' AND OLD.deleted_at IS NULL THEN
    UPDATE photos SET comment_count = comment_count - 1 WHERE id = OLD.photo_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE photos SET comment_count = comment_count - 1 WHERE id = NEW.photo_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE photos SET comment_count = comment_count + 1 WHERE id = NEW.photo_id;
    END IF;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comments_count
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION bump_comment_count();

-- =========================================================================
-- Row-Level Security
-- =========================================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE galleries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes             ENABLE ROW LEVEL SECURITY;

-- profiles: world-readable, owner-writable
CREATE POLICY "profiles_read"     ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update"   ON profiles FOR UPDATE USING (id = auth.uid());

-- photos: visible when public, unlisted (link only), or owned by viewer
CREATE POLICY "photos_read"
  ON photos FOR SELECT USING (
    deleted_at IS NULL
    AND (
      visibility IN ('public', 'unlisted')
      OR owner_id = auth.uid()
    )
  );
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "photos_update" ON photos FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (owner_id = auth.uid());

-- photo_variants: follow the parent photo's visibility via EXISTS
CREATE POLICY "variants_read"
  ON photo_variants FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = photo_variants.photo_id
        AND p.deleted_at IS NULL
        AND (p.visibility IN ('public','unlisted') OR p.owner_id = auth.uid())
    )
  );
CREATE POLICY "variants_write"
  ON photo_variants FOR ALL USING (
    EXISTS (SELECT 1 FROM photos p WHERE p.id = photo_variants.photo_id AND p.owner_id = auth.uid())
  );

-- photo_categories: readable with photo, writable by owner
CREATE POLICY "photo_cats_read"
  ON photo_categories FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = photo_categories.photo_id
        AND p.deleted_at IS NULL
        AND (p.visibility IN ('public','unlisted') OR p.owner_id = auth.uid())
    )
  );
CREATE POLICY "photo_cats_write"
  ON photo_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM photos p WHERE p.id = photo_categories.photo_id AND p.owner_id = auth.uid())
  );

-- galleries
CREATE POLICY "galleries_read"
  ON galleries FOR SELECT USING (
    visibility IN ('public','unlisted') OR owner_id = auth.uid()
  );
CREATE POLICY "galleries_write" ON galleries FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "gallery_photos_read"
  ON gallery_photos FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = gallery_photos.gallery_id
        AND (g.visibility IN ('public','unlisted') OR g.owner_id = auth.uid())
    )
  );
CREATE POLICY "gallery_photos_write"
  ON gallery_photos FOR ALL USING (
    EXISTS (SELECT 1 FROM galleries g WHERE g.id = gallery_photos.gallery_id AND g.owner_id = auth.uid())
  );

-- comments
CREATE POLICY "comments_read"
  ON comments FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = comments.photo_id
        AND p.deleted_at IS NULL
        AND (p.visibility IN ('public','unlisted') OR p.owner_id = auth.uid())
    )
  );
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (author_id = auth.uid());

-- likes
CREATE POLICY "likes_read"   ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (user_id = auth.uid());
