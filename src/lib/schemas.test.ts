import { describe, expect, it } from "vitest";
import {
  avatarUrlSchema,
  createCommentSchema,
  createExpeditionSchema,
  createPhotoSchema,
  MAX_AVATAR_BYTES,
  MAX_UPLOAD_BYTES,
  updateProfileSchema,
  uploadUrlSchema,
} from "./schemas";

// ---------------------------------------------------------------------------
// uploadUrlSchema
// ---------------------------------------------------------------------------

describe("uploadUrlSchema", () => {
  const valid = {
    filename: "photo.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1024,
  };

  it("accepts a minimal valid payload", () => {
    expect(uploadUrlSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts includeThumbnail with thumbnailSizeBytes", () => {
    const result = uploadUrlSchema.safeParse({
      ...valid,
      includeThumbnail: true,
      thumbnailSizeBytes: 512,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty filename", () => {
    expect(uploadUrlSchema.safeParse({ ...valid, filename: "" }).success).toBe(false);
  });

  it("rejects a filename longer than 256 chars", () => {
    expect(
      uploadUrlSchema.safeParse({ ...valid, filename: "a".repeat(257) }).success,
    ).toBe(false);
  });

  it("rejects a disallowed MIME type", () => {
    expect(
      uploadUrlSchema.safeParse({ ...valid, contentType: "image/gif" }).success,
    ).toBe(false);
  });

  it("rejects sizeBytes of 0", () => {
    expect(uploadUrlSchema.safeParse({ ...valid, sizeBytes: 0 }).success).toBe(false);
  });

  it("rejects sizeBytes exceeding MAX_UPLOAD_BYTES", () => {
    expect(
      uploadUrlSchema.safeParse({ ...valid, sizeBytes: MAX_UPLOAD_BYTES + 1 }).success,
    ).toBe(false);
  });

  it("accepts sizeBytes exactly equal to MAX_UPLOAD_BYTES", () => {
    expect(
      uploadUrlSchema.safeParse({ ...valid, sizeBytes: MAX_UPLOAD_BYTES }).success,
    ).toBe(true);
  });

  it("accepts all allowed MIME types", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp", "image/avif"] as const) {
      expect(uploadUrlSchema.safeParse({ ...valid, contentType }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// createPhotoSchema
// ---------------------------------------------------------------------------

describe("createPhotoSchema", () => {
  const valid = {
    storageKey: "users/abc/photos/xyz/original.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 2048,
    title: "Sunset",
  };

  it("accepts a minimal valid payload", () => {
    expect(createPhotoSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults visibility to 'public'", () => {
    const result = createPhotoSchema.safeParse(valid);
    expect(result.success && result.data.visibility).toBe("public");
  });

  it("defaults categoryIds and galleryIds to empty arrays", () => {
    const result = createPhotoSchema.safeParse(valid);
    expect(result.success && result.data.categoryIds).toEqual([]);
    expect(result.success && result.data.galleryIds).toEqual([]);
  });

  it("rejects an empty storageKey", () => {
    expect(createPhotoSchema.safeParse({ ...valid, storageKey: "" }).success).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(createPhotoSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("rejects a title longer than 200 chars", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, title: "a".repeat(201) }).success,
    ).toBe(false);
  });

  it("rejects a description longer than 5000 chars", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, description: "a".repeat(5001) }).success,
    ).toBe(false);
  });

  it("rejects an invalid visibility value", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, visibility: "protected" }).success,
    ).toBe(false);
  });

  it("accepts 'unlisted' and 'private' visibility", () => {
    expect(createPhotoSchema.safeParse({ ...valid, visibility: "unlisted" }).success).toBe(true);
    expect(createPhotoSchema.safeParse({ ...valid, visibility: "private" }).success).toBe(true);
  });

  it("accepts a valid location", () => {
    const result = createPhotoSchema.safeParse({
      ...valid,
      location: { lat: 48.8566, lng: 2.3522, name: "Paris" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects latitude out of range", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, location: { lat: 91, lng: 0 } }).success,
    ).toBe(false);
    expect(
      createPhotoSchema.safeParse({ ...valid, location: { lat: -91, lng: 0 } }).success,
    ).toBe(false);
  });

  it("rejects longitude out of range", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, location: { lat: 0, lng: 181 } }).success,
    ).toBe(false);
    expect(
      createPhotoSchema.safeParse({ ...valid, location: { lat: 0, lng: -181 } }).success,
    ).toBe(false);
  });

  it("accepts boundary lat/lng values", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, location: { lat: 90, lng: 180 } }).success,
    ).toBe(true);
    expect(
      createPhotoSchema.safeParse({ ...valid, location: { lat: -90, lng: -180 } }).success,
    ).toBe(true);
  });

  it("rejects more than 10 categoryIds", () => {
    const ids = Array.from({ length: 11 }, () => crypto.randomUUID());
    expect(createPhotoSchema.safeParse({ ...valid, categoryIds: ids }).success).toBe(false);
  });

  it("rejects non-UUID values in categoryIds", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, categoryIds: ["not-a-uuid"] }).success,
    ).toBe(false);
  });

  it("rejects more than 10 galleryIds", () => {
    const ids = Array.from({ length: 11 }, () => crypto.randomUUID());
    expect(createPhotoSchema.safeParse({ ...valid, galleryIds: ids }).success).toBe(false);
  });

  it("accepts a valid takenAt ISO datetime", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, takenAt: "2024-06-15T10:30:00.000Z" }).success,
    ).toBe(true);
  });

  it("rejects a non-datetime string for takenAt", () => {
    expect(
      createPhotoSchema.safeParse({ ...valid, takenAt: "June 15 2024" }).success,
    ).toBe(false);
  });

  it("accepts a valid thumbnail", () => {
    const result = createPhotoSchema.safeParse({
      ...valid,
      thumbnail: { storageKey: "users/abc/photos/xyz/thumbnail.avif", width: 300, height: 200 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a thumbnail with non-positive dimensions", () => {
    expect(
      createPhotoSchema.safeParse({
        ...valid,
        thumbnail: { storageKey: "key", width: 0, height: 200 },
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCommentSchema
// ---------------------------------------------------------------------------

describe("createCommentSchema", () => {
  it("accepts a minimal valid comment", () => {
    expect(createCommentSchema.safeParse({ body: "Nice photo!" }).success).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(createCommentSchema.safeParse({ body: "" }).success).toBe(false);
  });

  it("rejects a body exceeding 4000 chars", () => {
    expect(createCommentSchema.safeParse({ body: "a".repeat(4001) }).success).toBe(false);
  });

  it("accepts body of exactly 4000 chars", () => {
    expect(createCommentSchema.safeParse({ body: "a".repeat(4000) }).success).toBe(true);
  });

  it("accepts a valid parentId UUID", () => {
    expect(
      createCommentSchema.safeParse({ body: "Reply", parentId: crypto.randomUUID() }).success,
    ).toBe(true);
  });

  it("rejects a non-UUID parentId", () => {
    expect(
      createCommentSchema.safeParse({ body: "Reply", parentId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// avatarUrlSchema
// ---------------------------------------------------------------------------

describe("avatarUrlSchema", () => {
  const valid = {
    filename: "avatar.png",
    contentType: "image/png",
    sizeBytes: 1024,
  };

  it("accepts a valid payload", () => {
    expect(avatarUrlSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects sizeBytes exceeding MAX_AVATAR_BYTES", () => {
    expect(
      avatarUrlSchema.safeParse({ ...valid, sizeBytes: MAX_AVATAR_BYTES + 1 }).success,
    ).toBe(false);
  });

  it("accepts sizeBytes exactly equal to MAX_AVATAR_BYTES", () => {
    expect(
      avatarUrlSchema.safeParse({ ...valid, sizeBytes: MAX_AVATAR_BYTES }).success,
    ).toBe(true);
  });

  it("rejects a disallowed MIME type", () => {
    expect(
      avatarUrlSchema.safeParse({ ...valid, contentType: "image/gif" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateProfileSchema
// ---------------------------------------------------------------------------

describe("updateProfileSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid bio", () => {
    expect(updateProfileSchema.safeParse({ bio: "Photographer based in NYC" }).success).toBe(true);
  });

  it("rejects a bio longer than 1000 chars", () => {
    expect(updateProfileSchema.safeParse({ bio: "a".repeat(1001) }).success).toBe(false);
  });

  it("accepts a valid avatarUrl", () => {
    expect(
      updateProfileSchema.safeParse({ avatarUrl: "https://cdn.example.com/avatar.jpg" }).success,
    ).toBe(true);
  });

  it("rejects a non-URL avatarUrl", () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: "not-a-url" }).success).toBe(false);
  });

  it("rejects an avatarUrl longer than 500 chars", () => {
    const long = "https://example.com/" + "a".repeat(481);
    expect(updateProfileSchema.safeParse({ avatarUrl: long }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createExpeditionSchema
// ---------------------------------------------------------------------------

describe("createExpeditionSchema", () => {
  const valid = { title: "Alpine Trek" };

  it("accepts a minimal valid payload", () => {
    expect(createExpeditionSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults steps to an empty array", () => {
    const result = createExpeditionSchema.safeParse(valid);
    expect(result.success && result.data.steps).toEqual([]);
  });

  it("rejects an empty title", () => {
    expect(createExpeditionSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("rejects a title longer than 200 chars", () => {
    expect(
      createExpeditionSchema.safeParse({ ...valid, title: "a".repeat(201) }).success,
    ).toBe(false);
  });

  it("rejects a description longer than 5000 chars", () => {
    expect(
      createExpeditionSchema.safeParse({ ...valid, description: "a".repeat(5001) }).success,
    ).toBe(false);
  });

  it("accepts steps with valid location", () => {
    const result = createExpeditionSchema.safeParse({
      ...valid,
      steps: [{ description: "Base camp", locationName: "Camp 1", lat: 27.9881, lng: 86.9253 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a step with an empty description", () => {
    expect(
      createExpeditionSchema.safeParse({ ...valid, steps: [{ description: "" }] }).success,
    ).toBe(false);
  });

  it("rejects a step description longer than 5000 chars", () => {
    expect(
      createExpeditionSchema.safeParse({
        ...valid,
        steps: [{ description: "a".repeat(5001) }],
      }).success,
    ).toBe(false);
  });

  it("rejects step lat out of range", () => {
    expect(
      createExpeditionSchema.safeParse({
        ...valid,
        steps: [{ description: "Step", lat: 91, lng: 0 }],
      }).success,
    ).toBe(false);
  });

  it("rejects step lng out of range", () => {
    expect(
      createExpeditionSchema.safeParse({
        ...valid,
        steps: [{ description: "Step", lat: 0, lng: -181 }],
      }).success,
    ).toBe(false);
  });

  it("rejects more than 50 steps", () => {
    const steps = Array.from({ length: 51 }, (_, i) => ({ description: `Step ${i}` }));
    expect(createExpeditionSchema.safeParse({ ...valid, steps }).success).toBe(false);
  });

  it("accepts exactly 50 steps", () => {
    const steps = Array.from({ length: 50 }, (_, i) => ({ description: `Step ${i}` }));
    expect(createExpeditionSchema.safeParse({ ...valid, steps }).success).toBe(true);
  });
});
