import { z } from "zod";

export const VISIBILITY = ["public", "unlisted", "private"] as const;
export type Visibility = (typeof VISIBILITY)[number];

export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Request body for POST /api/upload-url */
export const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(256),
  contentType: z.enum(ALLOWED_MIME),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/** Request body for POST /api/photos — create the DB row after the R2 upload. */
export const createPhotoSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME),
  fileSizeBytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),

  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  licenseCode: z.string().max(32).optional(),
  visibility: z.enum(VISIBILITY).default("public"),

  categoryIds: z.array(z.string().uuid()).max(10).default([]),
  galleryIds: z.array(z.string().uuid()).max(10).default([]),

  location: z
    .object({
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
      name: z.string().max(200).optional(),
    })
    .optional(),

  takenAt: z.string().datetime().optional(),
  cameraMake: z.string().max(100).optional(),
  cameraModel: z.string().max(100).optional(),
});

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;

/** Request body for POST /api/photos/[id]/comments */
export const createCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  parentId: z.string().uuid().optional(),
});

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

/** Request body for POST /api/avatar-url */
export const avatarUrlSchema = z.object({
  filename: z.string().min(1).max(256),
  contentType: z.enum(ALLOWED_MIME),
  sizeBytes: z.number().int().positive().max(MAX_AVATAR_BYTES),
});

/** Request body for PATCH /api/profile */
export const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().max(500).optional(),
});
