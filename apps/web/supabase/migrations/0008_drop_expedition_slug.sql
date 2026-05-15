ALTER TABLE expeditions
  DROP CONSTRAINT expeditions_owner_id_slug_key,
  DROP COLUMN slug;
