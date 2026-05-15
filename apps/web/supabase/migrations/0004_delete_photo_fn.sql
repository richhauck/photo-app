-- Soft-deletes a photo owned by the calling user and returns its storage_key
-- for R2 cleanup. Returns NULL if the photo doesn't exist or isn't owned by
-- the caller (safe no-op — the app treats NULL as 404).
--
-- Using an RPC avoids PostgREST's implicit RETURNING on the UPDATE, which
-- would be re-checked against the photos_read SELECT policy and fail because
-- deleted_at is no longer NULL after the update.

CREATE OR REPLACE FUNCTION delete_photo(p_photo_id UUID)
  RETURNS TEXT
  LANGUAGE plpgsql
  SECURITY INVOKER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  UPDATE photos
     SET deleted_at = now()
   WHERE id          = p_photo_id
     AND owner_id    = auth.uid()
     AND deleted_at  IS NULL
  RETURNING storage_key INTO v_key;

  RETURN v_key;
END;
$$;
