const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const {
  buildObjectPath,
  uploadBuffer,
  deleteObject,
  createSignedReadUrl,
  getPublicUrl,
  isSupabaseConfigured,
} = require('../services/supabaseStorageService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  },
});

const GROUP_IMAGE_SIGNED_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours

const resolveGroupImageUri = async (row) => {
  const fallback = `/api/groups/image/${row.id}`;
  const stored = row.image_uri ? String(row.image_uri) : '';

  // Prefer a signed URL from Storage when we have a stored object.
  if (row.image_storage_path && isSupabaseConfigured()) {
    const signed = await createSignedReadUrl({
      bucket: row.image_storage_bucket,
      path: row.image_storage_path,
      expiresInSeconds: GROUP_IMAGE_SIGNED_URL_TTL_SECONDS,
    }).catch(() => null);

    if (signed) return signed;
  }

  return stored || fallback;
};

// Obtener mis grupos (paneles creados por el usuario)
router.get('/my-groups', authenticateToken, async (req, res) => {
  const ownerEmail = req.user.email;

  try {
    const result = await pool.query(
      `SELECT
         id,
         owner_email,
         (
           SELECT username
           FROM users u
           WHERE lower(u.email) = lower(user_groups.owner_email)
           LIMIT 1
         ) AS owner_username,
         hashtag,
         image_uri,
         image_storage_bucket,
         image_storage_path,
         created_at,
         updated_at,
         (
           SELECT COUNT(*)::int
           FROM group_members gm
           WHERE gm.group_id = user_groups.id
         ) AS member_count
       FROM user_groups
       WHERE owner_email = $1
       ORDER BY created_at DESC`,
      [ownerEmail]
    );

    const rows = await Promise.all(
      result.rows.map(async (r) => ({
        ...r,
        image_uri: await resolveGroupImageUri(r),
      }))
    );

    return res.json(rows);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener grupos a los que me he unido (tab: Unidos)
router.get('/joined-groups', authenticateToken, async (req, res) => {
  const memberEmail = req.user.email;

  try {
    const result = await pool.query(
      `SELECT
         g.id,
         g.owner_email,
         (
           SELECT username
           FROM users u
           WHERE lower(u.email) = lower(g.owner_email)
           LIMIT 1
         ) AS owner_username,
         g.hashtag,
         g.image_uri,
         g.image_storage_bucket,
         g.image_storage_path,
         g.created_at,
         g.updated_at,
         (
           SELECT COUNT(*)::int
           FROM group_members gm2
           WHERE gm2.group_id = g.id
         ) AS member_count
       FROM group_members gm
       JOIN user_groups g ON g.id = gm.group_id
       WHERE gm.member_email = $1
       ORDER BY gm.created_at DESC`,
      [memberEmail]
    );

    const rows = await Promise.all(
      result.rows.map(async (r) => ({
        ...r,
        image_uri: await resolveGroupImageUri(r),
      }))
    );

    return res.json(rows);
  } catch (error) {
    console.error('Error al obtener grupos unidos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Progreso de grupos para verificación (grupos creados + miembros activos totales)
router.get('/me/active-members-progress', authenticateToken, async (req, res) => {
  const ownerEmail = req.user?.email;
  if (!ownerEmail) return res.status(401).json({ error: 'No autorizado' });

  try {
    const [groupsRes, membersRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM user_groups WHERE owner_email = $1', [ownerEmail]),
      pool.query(
        `SELECT COUNT(DISTINCT gm.member_email)::int AS total
         FROM user_groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE g.owner_email = $1`,
        [ownerEmail]
      ),
    ]);

    const groupsCreated = groupsRes.rows?.[0]?.total ?? 0;
    const activeMembers = membersRes.rows?.[0]?.total ?? 0;
    return res.json({ groupsCreated, activeMembers });
  } catch (error) {
    console.error('Error getting groups active members progress:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar miembros de un grupo (dueño o miembros)
router.get('/:id/members', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const accessCheck = await pool.query(
      `SELECT 1
       FROM user_groups g
       WHERE g.id = $1
         AND (
           g.owner_email = $2
           OR EXISTS (
             SELECT 1 FROM group_members gm
             WHERE gm.group_id = g.id AND gm.member_email = $2
           )
         )
       LIMIT 1`,
      [id, userEmail]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const result = await pool.query(
      `SELECT
         gm.member_email,
         u.username,
         u.profile_photo_uri,
         u.social_networks,
         (gml.member_email IS NOT NULL) AS is_limited
       FROM group_members gm
       JOIN users u ON lower(u.email) = lower(gm.member_email)
       LEFT JOIN group_member_limits gml
         ON gml.group_id = gm.group_id
        AND lower(gml.member_email) = lower(gm.member_email)
       WHERE gm.group_id = $1
       ORDER BY gm.created_at DESC`,
      [id]
    );

    const mapped = result.rows.map((row) => {
      let socialNetworks = row.social_networks;

      if (typeof socialNetworks === 'string' && socialNetworks.trim().length > 0) {
        try {
          socialNetworks = JSON.parse(socialNetworks);
        } catch {
          // ignore
        }
      }

      if (!Array.isArray(socialNetworks)) {
        socialNetworks = [];
      }

      return {
        member_email: row.member_email,
        username: row.username,
        profile_photo_uri: row.profile_photo_uri,
        social_networks: socialNetworks,
        is_limited: !!row.is_limited,
      };
    });

    return res.json(mapped);
  } catch (error) {
    console.error('Error fetching group members:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir imagen del grupo desde BD
router.get('/image/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).send('ID inválido');
    }

    const result = await pool.query(
      'SELECT image_data, mime_type, image_uri, image_storage_bucket, image_storage_path FROM user_groups WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Imagen no encontrada');
    }

    const row = result.rows[0];

    // Prefer Storage when available.
    if (row.image_storage_path && isSupabaseConfigured()) {
      const signed = await createSignedReadUrl({
        bucket: row.image_storage_bucket,
        path: row.image_storage_path,
        expiresInSeconds: 15 * 60,
      }).catch(() => null);
      if (signed) {
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.redirect(302, signed);
      }
    }

    // If image_uri is an absolute URL, redirect.
    if (row.image_uri && /^https?:\/\//i.test(String(row.image_uri))) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.redirect(302, String(row.image_uri));
    }

    // Legacy fallback: serve from DB.
    if (!row.image_data) {
      return res.status(404).send('Imagen no encontrada');
    }

    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.send(row.image_data);
  } catch (error) {
    console.error('Error al obtener imagen de grupo:', error);
    res.status(500).send('Error al obtener imagen');
  }
});

// Crear un grupo
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  const ownerEmail = req.user.email;
  const hashtag = (req.body.hashtag || '').toString().trim();
  const file = req.file;

  if (!hashtag || !file) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM user_groups WHERE owner_email = $1',
      [ownerEmail]
    );

    if ((countResult.rows[0]?.count ?? 0) >= 5) {
      return res.status(400).json({ error: 'Has alcanzado el máximo de 5 grupos' });
    }

    if (!isSupabaseConfigured()) {
      const legacy = await pool.query(
        `INSERT INTO user_groups (owner_email, hashtag, image_data, mime_type, image_uri)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id, owner_email, hashtag, created_at, updated_at`,
        [ownerEmail, hashtag, file.buffer, file.mimetype]
      );

      const row = legacy.rows[0];
      return res.status(201).json({
        ...row,
        image_uri: `/api/groups/image/${row.id}`,
      });
    }

    // 1) Create group row first to get an ID for the object path.
    const created = await pool.query(
      `INSERT INTO user_groups (owner_email, hashtag, image_data, mime_type, image_uri, image_storage_bucket, image_storage_path)
       VALUES ($1, $2, NULL, NULL, NULL, NULL, NULL)
       RETURNING id, owner_email, hashtag, created_at, updated_at`,
      [ownerEmail, hashtag]
    );

    const row = created.rows[0];

    // 2) Upload to Supabase Storage.
    const objectPath = buildObjectPath({
      kind: 'group-images',
      ownerEmail,
      groupId: row.id,
      mimeType: file.mimetype,
    });

    const uploaded = await uploadBuffer({
      buffer: file.buffer,
      mimeType: file.mimetype,
      path: objectPath,
    });

    const publicUrl = await getPublicUrl({ bucket: uploaded.bucket, path: uploaded.path }).catch(() => null);

    // 3) Save pointers.
    const updated = await pool.query(
      `UPDATE user_groups
       SET mime_type = $1,
           image_uri = $2,
           image_storage_bucket = $3,
           image_storage_path = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND owner_email = $6
       RETURNING id, owner_email, hashtag, created_at, updated_at, image_uri, image_storage_bucket, image_storage_path`,
      [file.mimetype, publicUrl, uploaded.bucket, uploaded.path, row.id, ownerEmail]
    );

    const out = updated.rows[0] || row;
    const resolved = await resolveGroupImageUri({
      ...out,
      image_storage_bucket: uploaded.bucket,
      image_storage_path: uploaded.path,
    });
    return res.status(201).json({
      ...out,
      image_uri: resolved,
    });
  } catch (error) {
    console.error('Error al crear grupo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar un grupo
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  const ownerEmail = req.user.email;
  const id = Number(req.params.id);
  const hashtag = (req.body.hashtag || '').toString().trim();
  const file = req.file;

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (!hashtag) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    let result;
    if (file) {
      if (!isSupabaseConfigured()) {
        result = await pool.query(
          `UPDATE user_groups
           SET hashtag = $1,
               image_data = $2,
               mime_type = $3,
               image_uri = NULL,
               image_storage_bucket = NULL,
               image_storage_path = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 AND owner_email = $5
           RETURNING id, owner_email, hashtag, created_at, updated_at, image_uri, image_storage_bucket, image_storage_path`,
          [hashtag, file.buffer, file.mimetype, id, ownerEmail]
        );
      } else {
      const prev = await pool.query(
        'SELECT image_storage_bucket, image_storage_path FROM user_groups WHERE id = $1 AND owner_email = $2 LIMIT 1',
        [id, ownerEmail]
      );
      const prevBucket = prev.rows?.[0]?.image_storage_bucket || null;
      const prevPath = prev.rows?.[0]?.image_storage_path || null;

      const objectPath = buildObjectPath({
        kind: 'group-images',
        ownerEmail,
        groupId: id,
        mimeType: file.mimetype,
      });

      const uploaded = await uploadBuffer({
        buffer: file.buffer,
        mimeType: file.mimetype,
        path: objectPath,
      });

      const publicUrl = await getPublicUrl({ bucket: uploaded.bucket, path: uploaded.path }).catch(() => null);

      result = await pool.query(
        `UPDATE user_groups
         SET hashtag = $1,
             image_data = NULL,
             mime_type = $2,
             image_uri = $3,
             image_storage_bucket = $4,
             image_storage_path = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND owner_email = $7
         RETURNING id, owner_email, hashtag, created_at, updated_at, image_uri, image_storage_bucket, image_storage_path`,
        [hashtag, file.mimetype, publicUrl, uploaded.bucket, uploaded.path, id, ownerEmail]
      );

      if (prevBucket && prevPath) {
        await deleteObject({ bucket: prevBucket, path: prevPath });
      }
      }
    } else {
      result = await pool.query(
        `UPDATE user_groups
         SET hashtag = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND owner_email = $3
         RETURNING id, owner_email, hashtag, created_at, updated_at, image_uri, image_storage_bucket, image_storage_path`,
        [hashtag, id, ownerEmail]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const row = result.rows[0];
    const resolved = await resolveGroupImageUri(row);
    return res.json({
      ...row,
      image_uri: resolved,
    });
  } catch (error) {
    console.error('Error al actualizar grupo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar un grupo
router.delete('/:id', authenticateToken, async (req, res) => {
  const ownerEmail = req.user.email;
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  let groupImageRef = null;
  let extraImageRefs = [];
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Collect all Supabase Storage refs related to this group BEFORE deleting (because of ON DELETE CASCADE).
      const groupRes = await client.query(
        'SELECT image_storage_bucket, image_storage_path FROM user_groups WHERE id = $1 AND owner_email = $2 LIMIT 1',
        [id, ownerEmail]
      );

      if (groupRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      groupImageRef = {
        bucket: groupRes.rows[0]?.image_storage_bucket || null,
        path: groupRes.rows[0]?.image_storage_path || null,
      };

      const imgs = await client.query(
        'SELECT storage_bucket, storage_path FROM uploaded_images WHERE group_id = $1 AND storage_path IS NOT NULL',
        [id]
      );
      extraImageRefs = (imgs.rows || []).map(r => ({
        bucket: r.storage_bucket || null,
        path: r.storage_path || null,
      })).filter(r => r.bucket && r.path);

      const result = await client.query(
        'DELETE FROM user_groups WHERE id = $1 AND owner_email = $2 RETURNING id',
        [id, ownerEmail]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    // Best-effort: remove objects from Supabase Storage.
    if (groupImageRef?.bucket && groupImageRef?.path) {
      await deleteObject({ bucket: groupImageRef.bucket, path: groupImageRef.path });
    }
    for (const ref of extraImageRefs) {
      await deleteObject({ bucket: ref.bucket, path: ref.path });
    }

    return res.json({ message: 'Grupo eliminado', id });
  } catch (error) {
    console.error('Error al eliminar grupo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Salir de un grupo (solo si estoy unido)
router.post('/:id/leave', authenticateToken, async (req, res) => {
  const memberEmail = req.user.email;
  const id = Number(req.params.id);
  const shouldBlock = !!(req.body && (req.body.block === true || req.body.block === 1 || req.body.block === '1'));
  const rawReason = (req.body?.reason ?? req.body?.blockReason ?? '').toString();
  const blockReason = rawReason.trim().slice(0, 320) || 'Sin motivo';

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const groupCheck = await pool.query('SELECT owner_email FROM user_groups WHERE id = $1', [id]);
    const ownerEmail = groupCheck.rows[0]?.owner_email;
    if (!ownerEmail) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const result = await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND member_email = $2 RETURNING group_id',
      [id, memberEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No eres miembro de este grupo' });
    }

    // Reflejar el estado para el creador (host) en el chat general.
    // - leave: vuelve al estado original (mostrar icono "Agregar a grupo")
    // - leave+block: mostrar "Bloqueado"
    const nextStatus = shouldBlock ? 'blocked' : 'left';
    await pool.query(
      `UPDATE group_join_requests
       SET status = $4::varchar,
           responded_at = CURRENT_TIMESTAMP,
           block_reason = CASE WHEN $4::varchar = 'blocked' THEN $5::text ELSE NULL::text END
       WHERE group_id = $1 AND requester_email = $2 AND target_email = $3`,
      [id, ownerEmail, memberEmail, nextStatus, blockReason]
    );

    // Si el usuario eligió "Salir y Bloquear", registrar el bloqueo del anfitrión.
    // Esto se usa para ocultar publicaciones del anfitrión y para mostrarlo en
    // "Configuración -> Usuarios bloqueados".
    if (shouldBlock && ownerEmail && ownerEmail !== memberEmail) {
      await pool.query(
        `INSERT INTO group_join_requests (group_id, requester_email, target_email, status, block_reason, created_at, responded_at)
         VALUES ($1, $2, $3, 'blocked', $4::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (group_id, requester_email, target_email)
         DO UPDATE SET status = 'blocked',
                       block_reason = EXCLUDED.block_reason,
                       responded_at = CURRENT_TIMESTAMP`,
        [id, memberEmail, ownerEmail, blockReason]
      );
    }

    return res.json({ ok: true, id });
  } catch (error) {
    console.error('Error al salir del grupo:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar miembros limitados (solo dueño del grupo)
router.get('/:id/limited-members', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const groupCheck = await pool.query('SELECT owner_email FROM user_groups WHERE id = $1', [id]);
    const ownerEmail = groupCheck.rows[0]?.owner_email;
    if (!ownerEmail) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (ownerEmail !== requesterEmail) return res.status(403).json({ error: 'No autorizado' });

    const result = await pool.query(
      `SELECT member_email
       FROM group_member_limits
       WHERE group_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return res.json(result.rows.map(r => String(r.member_email)));
  } catch (error) {
    console.error('Error fetching limited members:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener mensajes del chat de grupo
router.get('/:id/messages', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const hasPaginationParams = (req.query?.limit !== undefined) || (req.query?.beforeId !== undefined);

  const parsedLimit = Number(req.query?.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, Math.trunc(parsedLimit)))
    : 40;

  const parsedBeforeId = Number(req.query?.beforeId);
  const beforeId = Number.isFinite(parsedBeforeId) ? Math.trunc(parsedBeforeId) : null;

  try {
    const accessCheck = await pool.query(
      `SELECT 1
       FROM user_groups g
       WHERE g.id = $1
         AND (
           g.owner_email = $2
           OR EXISTS (
             SELECT 1 FROM group_members gm
             WHERE gm.group_id = g.id AND gm.member_email = $2
           )
         )
       LIMIT 1`,
      [id, userEmail]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    if (!hasPaginationParams) {
      const result = await pool.query(
        `SELECT gm.*, u.username
         FROM group_messages gm
         JOIN users u ON gm.sender_email = u.email
         WHERE gm.group_id = $1
         ORDER BY gm.id ASC`,
        [id]
      );
      res.json(result.rows);
      return;
    }

    const whereBeforeClause = beforeId ? 'AND gm.id < $2' : '';
    const queryParams = beforeId
      ? [id, beforeId, limit + 1]
      : [id, limit + 1];

    const result = await pool.query(
      `SELECT page.*, u.username
       FROM (
         SELECT gm.*
         FROM group_messages gm
         WHERE gm.group_id = $1
           ${whereBeforeClause}
         ORDER BY gm.id DESC
         LIMIT $${beforeId ? 3 : 2}
       ) AS page
       JOIN users u ON page.sender_email = u.email
       ORDER BY page.id ASC`,
      queryParams
    );

    const rows = result.rows || [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(rows.length - limit) : rows;

    res.json({
      messages: pageRows,
      hasMore,
    });
  } catch (error) {
    console.error('Error al obtener mensajes de grupo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Enviar mensaje al chat de grupo
router.post('/:id/messages', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;
  const senderEmail = req.user.email;
  const id = Number(req.params.id);
  const message = (req.body?.message || '').toString();
  const replyToIdRaw = req.body?.replyToId;
  const replyToId = (replyToIdRaw === null || replyToIdRaw === undefined || replyToIdRaw === '')
    ? null
    : Number(replyToIdRaw);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (!message.trim()) {
    return res.status(400).json({ error: 'Mensaje vacío' });
  }

  if (replyToId !== null && !Number.isFinite(replyToId)) {
    return res.status(400).json({ error: 'replyToId inválido' });
  }

  try {
    const accessCheck = await pool.query(
      `SELECT 1
       FROM user_groups g
       WHERE g.id = $1
         AND (
           g.owner_email = $2
           OR EXISTS (
             SELECT 1 FROM group_members gm
             WHERE gm.group_id = g.id AND gm.member_email = $2
           )
         )
       LIMIT 1`,
      [id, userEmail]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    if (replyToId !== null) {
      // Ensure the replied-to message exists and belongs to this group
      const replyCheck = await pool.query(
        'SELECT 1 FROM group_messages WHERE id = $1 AND group_id = $2 LIMIT 1',
        [replyToId, id]
      );
      if (replyCheck.rows.length === 0) {
        return res.status(400).json({ error: 'El mensaje al que respondes no existe en este grupo' });
      }
    }

    // Si el usuario está limitado (y no es el dueño), no puede enviar mensajes
    const ownerCheck = await pool.query('SELECT owner_email FROM user_groups WHERE id = $1', [id]);
    const ownerEmail = ownerCheck.rows[0]?.owner_email;
    if (ownerEmail && senderEmail !== ownerEmail) {
      const limited = await pool.query(
        'SELECT 1 FROM group_member_limits WHERE group_id = $1 AND member_email = $2 LIMIT 1',
        [id, senderEmail]
      );
      if (limited.rows.length > 0) {
        return res.status(403).json({ error: 'El anfitrión te ha limitado las interacciones' });
      }
    }

    const insertResult = await pool.query(
      'INSERT INTO group_messages (group_id, sender_email, message, reply_to_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, senderEmail, message, replyToId]
    );

    const msgRow = insertResult.rows[0];
    const userRow = await pool.query('SELECT username FROM users WHERE email = $1', [senderEmail]);
    res.status(201).json({ ...msgRow, username: userRow.rows[0]?.username });
  } catch (error) {
    console.error('Error al enviar mensaje de grupo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Limitar a un miembro (solo dueño del grupo)
router.post('/:id/limit', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const id = Number(req.params.id);
  const memberEmail = String(req.body?.memberEmail || '').trim();

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!memberEmail) {
    return res.status(400).json({ error: 'memberEmail requerido' });
  }

  try {
    const groupCheck = await pool.query('SELECT owner_email FROM user_groups WHERE id = $1', [id]);
    const ownerEmail = groupCheck.rows[0]?.owner_email;
    if (!ownerEmail) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (ownerEmail !== requesterEmail) return res.status(403).json({ error: 'No autorizado' });
    if (memberEmail === ownerEmail) return res.status(400).json({ error: 'No puedes limitar al creador' });

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND member_email = $2 LIMIT 1',
      [id, memberEmail]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no es miembro del grupo' });
    }

    await pool.query(
      `INSERT INTO group_member_limits (group_id, member_email, limited_by_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, member_email) DO UPDATE
       SET limited_by_email = EXCLUDED.limited_by_email,
           created_at = CURRENT_TIMESTAMP`,
      [id, memberEmail, requesterEmail]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error limiting group member:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Quitar limitación a un miembro (solo dueño del grupo)
router.post('/:id/unlimit', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const id = Number(req.params.id);
  const memberEmail = String(req.body?.memberEmail || '').trim();

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!memberEmail) {
    return res.status(400).json({ error: 'memberEmail requerido' });
  }

  try {
    const groupCheck = await pool.query('SELECT owner_email FROM user_groups WHERE id = $1', [id]);
    const ownerEmail = groupCheck.rows[0]?.owner_email;
    if (!ownerEmail) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (ownerEmail !== requesterEmail) return res.status(403).json({ error: 'No autorizado' });
    if (memberEmail === ownerEmail) return res.status(400).json({ error: 'No puedes quitar la limitación al creador' });

    await pool.query(
      'DELETE FROM group_member_limits WHERE group_id = $1 AND member_email = $2',
      [id, memberEmail]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error unlimiting group member:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Expulsar a un miembro (solo dueño del grupo)
router.post('/:id/expel', authenticateToken, async (req, res) => {
  const requesterEmail = req.user.email;
  const id = Number(req.params.id);
  const memberEmail = String(req.body?.memberEmail || '').trim();
  const shouldBlock = !!(req.body && (req.body.block === true || req.body.block === 1 || req.body.block === '1'));
  const rawReason = (req.body?.reason ?? req.body?.blockReason ?? '').toString();
  const blockReason = rawReason.trim().slice(0, 320) || 'Sin motivo';

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!memberEmail) {
    return res.status(400).json({ error: 'memberEmail requerido' });
  }

  try {
    const groupCheck = await pool.query('SELECT owner_email FROM user_groups WHERE id = $1', [id]);
    const ownerEmail = groupCheck.rows[0]?.owner_email;
    if (!ownerEmail) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (ownerEmail !== requesterEmail) return res.status(403).json({ error: 'No autorizado' });
    if (memberEmail === ownerEmail) return res.status(400).json({ error: 'No puedes expulsarte' });

    const deleted = await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND member_email = $2 RETURNING group_id',
      [id, memberEmail]
    );

    // Limpieza: si estaba limitado, quitarlo también
    await pool.query('DELETE FROM group_member_limits WHERE group_id = $1 AND member_email = $2', [id, memberEmail]);

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no es miembro del grupo' });
    }

    // Al expulsar (con o sin bloqueo), eliminar automáticamente sus mensajes en este grupo.
    await pool.query(
      'DELETE FROM group_messages WHERE group_id = $1 AND sender_email = $2',
      [id, memberEmail]
    );

    // Reflejar el estado para el creador (host) en el chat general.
    // - expel: vuelve al estado original (mostrar icono "Agregar a grupo")
    // - expel+block: mostrar "Bloqueado"
    const nextStatus = shouldBlock ? 'blocked' : 'left';
    const reasonOrNull = nextStatus === 'blocked' ? blockReason : null;
    await pool.query(
      `INSERT INTO group_join_requests (group_id, requester_email, target_email, status, block_reason, created_at, responded_at)
       VALUES ($1, $2, $3, $4::varchar, $5::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (group_id, requester_email, target_email)
       DO UPDATE SET status = EXCLUDED.status,
                     block_reason = EXCLUDED.block_reason,
                     responded_at = CURRENT_TIMESTAMP`,
      [id, requesterEmail, memberEmail, nextStatus, reasonOrNull]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error expelling group member:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
