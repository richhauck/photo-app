-- RPC: set the PostGIS location on a photo the caller owns.
-- Keeps the JS client free of raw SQL while RLS still enforces ownership.

CREATE OR REPLACE FUNCTION set_photo_location(
  p_photo_id UUID,
  p_lng      DOUBLE PRECISION,
  p_lat      DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE photos
     SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
   WHERE id = p_photo_id
     AND owner_id = auth.uid();
END;
$$;
