-- PostgREST computed columns: expose lat/lng from the PostGIS geography column
-- so the JS client can select them as plain numeric fields.

CREATE OR REPLACE FUNCTION photos_lat(photos)
  RETURNS double precision
  LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT ST_Y($1.location::geometry);
$$;

CREATE OR REPLACE FUNCTION photos_lng(photos)
  RETURNS double precision
  LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT ST_X($1.location::geometry);
$$;
