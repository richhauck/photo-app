-- gallery_photos must be dropped before galleries (FK: gallery_photos.gallery_id → galleries.id)
DROP TABLE gallery_photos;

-- galleries.cover_photo_id → photos (ON DELETE SET NULL), safe to drop directly
DROP TABLE galleries;

-- photo_categories must be dropped before categories (FK: photo_categories.category_id → categories.id)
DROP TABLE photo_categories;

-- categories were only used to populate photo_categories; no other references remain
DROP TABLE categories;
