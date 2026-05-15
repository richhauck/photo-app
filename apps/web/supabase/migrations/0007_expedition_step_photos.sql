-- Each expedition step holds a gallery of photos contributed by members.
-- A photo can appear in a step at most once (UNIQUE constraint).
-- Only public/unlisted photos may be linked (enforced in the INSERT policy).

CREATE TABLE expedition_step_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         UUID NOT NULL REFERENCES expedition_steps(id) ON DELETE CASCADE,
  photo_id        UUID NOT NULL REFERENCES photos(id)           ON DELETE CASCADE,
  contributor_id  UUID NOT NULL REFERENCES profiles(id)         ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_id, photo_id)
);

CREATE INDEX idx_esp_step        ON expedition_step_photos (step_id, created_at ASC);
CREATE INDEX idx_esp_contributor ON expedition_step_photos (contributor_id);

ALTER TABLE expedition_step_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can read (expeditions are public)
CREATE POLICY "esp_read" ON expedition_step_photos FOR SELECT USING (true);

-- Only the owner of a public/unlisted photo may associate it
CREATE POLICY "esp_insert" ON expedition_step_photos FOR INSERT
  WITH CHECK (
    contributor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = photo_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
        AND p.visibility IN ('public', 'unlisted')
    )
  );

-- Only the contributor may remove their own link
CREATE POLICY "esp_delete" ON expedition_step_photos FOR DELETE
  USING (contributor_id = auth.uid());
