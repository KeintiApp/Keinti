-- Allow channel and account audio uploads in the main media bucket.
-- Safe to re-run: if the bucket does not exist yet, this is a no-op.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'audio/mp4',
    'audio/aac',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/opus'
  ]::text[],
  updated_at = NOW()
WHERE id = 'keinti_media';