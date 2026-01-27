const crypto = require('crypto');
const { getSupabaseAdminClient, getSupabaseStorageBucket, isSupabaseConfigured } = require('../config/supabase');

function safePathSegment(value) {
  // Keep it path-safe and predictable.
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@-]+/g, '_')
    .slice(0, 120);
}

function inferExtension(mimeType) {
  const mt = String(mimeType || '').toLowerCase();
  if (mt.includes('png')) return 'png';
  if (mt.includes('webp')) return 'webp';
  if (mt.includes('heic')) return 'heic';
  if (mt.includes('heif')) return 'heif';
  if (mt.includes('gif')) return 'gif';
  if (mt.includes('jpeg') || mt.includes('jpg')) return 'jpg';
  return 'bin';
}

function buildObjectPath({ kind, ownerEmail, postId, groupId, mimeType }) {
  const ext = inferExtension(mimeType);
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  const base = safePathSegment(kind || 'misc');
  const owner = ownerEmail ? safePathSegment(ownerEmail) : 'anonymous';

  if (postId) return `${base}/posts/${Number(postId)}/${owner}/${id}.${ext}`;
  if (groupId) return `${base}/groups/${Number(groupId)}/${owner}/${id}.${ext}`;
  return `${base}/users/${owner}/${id}.${ext}`;
}

async function uploadBuffer({ buffer, mimeType, path }) {
  if (!isSupabaseConfigured()) {
    const e = new Error('Supabase Storage is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    // @ts-ignore
    e.code = 'SUPABASE_NOT_CONFIGURED';
    throw e;
  }
  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    const e = new Error(error.message || 'Error uploading to Supabase Storage');
    e.cause = error;
    throw e;
  }

  return {
    bucket,
    path: data?.path || path,
  };
}

async function deleteObject({ bucket, path }) {
  if (!bucket || !path) return;
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();

  // Best-effort delete.
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    // Do not throw to avoid breaking cleanup flows.
    console.warn('[SupabaseStorage] Failed to delete object:', error.message || error);
  }
}

async function createSignedReadUrl({ bucket, path, expiresInSeconds }) {
  if (!isSupabaseConfigured()) {
    const e = new Error('Supabase Storage is not configured');
    // @ts-ignore
    e.code = 'SUPABASE_NOT_CONFIGURED';
    throw e;
  }
  const supabase = getSupabaseAdminClient();
  const b = bucket || getSupabaseStorageBucket();
  const exp = Math.max(60, Math.min(Number(expiresInSeconds || 900), 60 * 60 * 24));

  const { data, error } = await supabase.storage.from(b).createSignedUrl(path, exp);
  if (error) {
    const e = new Error(error.message || 'Error creating signed URL');
    e.cause = error;
    throw e;
  }

  return data?.signedUrl || null;
}

async function getPublicUrl({ bucket, path }) {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const b = bucket || getSupabaseStorageBucket();
  const { data } = supabase.storage.from(b).getPublicUrl(path);
  return data?.publicUrl || null;
}

module.exports = {
  buildObjectPath,
  uploadBuffer,
  deleteObject,
  createSignedReadUrl,
  getPublicUrl,
  isSupabaseConfigured,
};
