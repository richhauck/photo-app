# Photo App

Next.js 15 (App Router) + Supabase (Postgres with PostGIS + Auth) + Cloudflare R2 (image storage).

## What's wired up

- **Auth** — email/password via Supabase. Session refresh in `src/middleware.ts`, server client in `src/lib/supabase/server.ts`, browser client in `src/lib/supabase/client.ts`.
- **Schema** — full schema with RLS in `supabase/migrations/0001_init.sql` (profiles, photos, categories, galleries, comments, likes, PostGIS location). RPC for geo updates in `0002_rpc.sql`.
- **Upload flow** — browser → `/api/upload-url` → pre-signed PUT to R2 → `/api/photos` to insert row. See `src/components/UploadForm.tsx`.
- **Feed** — `src/app/page.tsx` lists recent public photos served from R2 via `next/image`.
- **Photo detail** — `src/app/photos/[id]/page.tsx` with `LikeButton` and `CommentsSection` (both write directly via the Supabase JS client, protected by RLS).

## Setup

### 1. Install

```bash
cd photo-app
npm install
cp .env.local.example .env.local
# fill in values (see below)
```

### 2. Supabase

1. Create a Supabase project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql` then `0002_rpc.sql`.
3. Copy **Project URL** and **anon key** from Project Settings → API into `.env.local`.
4. Enable email auth under Authentication → Providers. For dev you can disable "Confirm email".

### 3. Cloudflare R2

1. Create an R2 bucket (e.g. `photo-app-originals`).
2. Settings → R2 API Tokens → create token with **Object Read & Write** on that bucket.
3. Copy the account ID, access key, and secret into `.env.local`.
4. Enable public access (for dev: the `pub-xxxx.r2.dev` URL; for prod: attach a custom domain + Cloudflare CDN).
5. **Configure CORS** on the bucket so the browser can PUT directly:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

### 4. Run it

```bash
npm run dev
```

Visit http://localhost:3000, sign up, upload a photo.

## Architecture notes

**Why R2 instead of Supabase Storage?** Egress-free pricing. The upload flow is identical — pre-signed S3 URL the browser PUTs to directly. Swap to Supabase Storage by changing `src/lib/r2.ts` to use `supabase.storage.from(...).createSignedUploadUrl(...)`.

**Why RLS-first data access on reads/writes?** Comments, likes, and photo listing all go through Supabase's JS client from the browser or server. RLS enforces ownership and visibility, so you can't accidentally leak a private photo by forgetting a WHERE clause in the app.

**Why an RPC for `location`?** The PostGIS `geography` type needs `ST_MakePoint(...)::geography` which the JS query builder can't emit. `set_photo_location` wraps that SQL and preserves ownership checks.

## Next steps worth doing

- **MapLibre picker** in `UploadForm` — drop a pin, reverse-geocode via Nominatim, store the coordinates and `location_name` automatically.
- **Image processing worker** — listen for new `photos` rows (Supabase DB webhook or Realtime) and generate `thumb/medium/large` variants with Sharp, writing back to R2 and the `photo_variants` table.
- **Supabase typed queries** — run `supabase gen types typescript` to drop the `@ts-expect-error` comments on joined selects.
- **OAuth providers** — add Google/GitHub login via Supabase Auth → Providers.
- **Realtime comments** — subscribe to the `comments` table from the detail page with `supabase.channel(...).on('postgres_changes', ...)`.

## File map

```
photo-app/
├─ supabase/migrations/     # SQL: schema, RLS, RPC
├─ src/
│  ├─ middleware.ts         # session refresh
│  ├─ app/
│  │  ├─ layout.tsx         # nav + auth-aware header
│  │  ├─ page.tsx           # public feed
│  │  ├─ login/            signup/            upload/
│  │  ├─ photos/[id]/       # photo detail
│  │  ├─ auth/logout/       # POST logout route
│  │  └─ api/
│  │     ├─ upload-url/     # pre-signed R2 PUT
│  │     └─ photos/         # create photo row
│  ├─ components/           # UploadForm, LikeButton, CommentsSection
│  └─ lib/
│     ├─ supabase/          # client.ts, server.ts, middleware.ts
│     ├─ r2.ts              # R2 S3 client + pre-signed URLs
│     └─ schemas.ts         # Zod validation schemas
```
# photo-app
