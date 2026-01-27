const pool = require('../config/database');
const { getPostTtlMinutes } = require('../config/postTtl');
const { deleteObject } = require('./supabaseStorageService');

const POST_TTL_MINUTES = getPostTtlMinutes();

async function deleteUploadedImagesByPostIds(postIds) {
  const ids = Array.isArray(postIds) ? postIds.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
  if (ids.length === 0) return;

  const batchSize = 200;
  let deletedCount = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const result = await pool.query(
      'DELETE FROM uploaded_images WHERE post_id = ANY($1::int[]) RETURNING storage_bucket, storage_path',
      [batch]
    ).catch(() => null);

    const rows = result?.rows || [];
    deletedCount += rows.length;

    for (const r of rows) {
      const bucket = r.storage_bucket || null;
      const path = r.storage_path || null;
      if (bucket && path) {
        await deleteObject({ bucket, path }).catch(() => {});
      }
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 Se eliminaron ${deletedCount} archivos asociados a posts expirados/borrados.`);
  }
}

async function deleteChannelDataByPostIds(postIds) {
  const ids = Array.isArray(postIds) ? postIds.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
  if (ids.length === 0) return;

  const batchSize = 500;
  let deletedMessages = 0;
  let deletedSubscriptions = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);

    const delMsgs = await pool
      .query('DELETE FROM channel_messages WHERE post_id = ANY($1::int[])', [batch])
      .catch(() => null);
    deletedMessages += delMsgs?.rowCount || 0;

    const delSubs = await pool
      .query('DELETE FROM channel_subscriptions WHERE post_id = ANY($1::int[])', [batch])
      .catch(() => null);
    deletedSubscriptions += delSubs?.rowCount || 0;
  }

  if (deletedMessages > 0 || deletedSubscriptions > 0) {
    console.log(
      `🧹 Se limpiaron canales de posts expirados/borrados: ${deletedSubscriptions} suscripciones, ${deletedMessages} mensajes.`
    );
  }
}

async function deletePostEngagementByPostIds(postIds) {
  const ids = Array.isArray(postIds) ? postIds.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
  if (ids.length === 0) return;

  const batchSize = 1000;
  let deletedReactions = 0;
  let deletedVotes = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);

    const delReactions = await pool
      .query('DELETE FROM post_reactions WHERE post_id = ANY($1::int[])', [batch])
      .catch(() => null);
    deletedReactions += delReactions?.rowCount || 0;

    const delVotes = await pool
      .query('DELETE FROM post_poll_votes WHERE post_id = ANY($1::int[])', [batch])
      .catch(() => null);
    deletedVotes += delVotes?.rowCount || 0;
  }

  if (deletedReactions > 0 || deletedVotes > 0) {
    console.log(
      `🧹 Se limpiaron interacciones de posts expirados/borrados: ${deletedReactions} reacciones, ${deletedVotes} votos.`
    );
  }
}

async function deleteIntimidadesOpensByPostIds(postIds) {
  const ids = Array.isArray(postIds) ? postIds.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
  if (ids.length === 0) return;

  const batchSize = 1000;
  let deletedOpens = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const del = await pool
      .query('DELETE FROM post_intimidades_opens WHERE post_id = ANY($1::int[])', [batch])
      .catch(() => null);
    deletedOpens += del?.rowCount || 0;
  }

  if (deletedOpens > 0) {
    console.log(`🧹 Se limpiaron ${deletedOpens} aperturas de intimidades de posts expirados/borrados.`);
  }
}

// Eliminar selfies de verificación ya revisados (aceptados/fallidos)
// para minimizar retención de datos biométricos.
const deleteReviewedAccountSelfies = async () => {
  try {
    const result = await pool.query(
      `SELECT user_email, selfie_image_id
       FROM account_auth
       WHERE selfie_image_id IS NOT NULL
         AND selfie_status IN ('accepted', 'failed')`
    );

    const rows = result.rows || [];
    for (const r of rows) {
      const imgId = Number(r.selfie_image_id);
      if (!Number.isFinite(imgId) || imgId <= 0) continue;
      const imgRow = await pool
        .query('SELECT storage_bucket, storage_path FROM uploaded_images WHERE id = $1 LIMIT 1', [imgId])
        .catch(() => null);
      const bucket = imgRow?.rows?.[0]?.storage_bucket || null;
      const path = imgRow?.rows?.[0]?.storage_path || null;

      await pool.query('DELETE FROM uploaded_images WHERE id = $1', [imgId]).catch(() => {});
      if (bucket && path) {
        await deleteObject({ bucket, path });
      }
      await pool.query(
        'UPDATE account_auth SET selfie_image_id = NULL WHERE user_email = $1',
        [r.user_email]
      ).catch(() => {});
    }

    if (rows.length > 0) {
      console.log(`🧹 Se limpiaron ${rows.length} selfies revisados de autenticación.`);
    }
  } catch (error) {
    console.error('❌ Error al limpiar selfies revisados:', error);
  }
};

// Limpieza relacionada con posts expirados / borrados (sin borrar el post):
// - Conserva registros para verificación/métricas.
// - Elimina solicitudes pendientes ligadas a posts expirados o borrados.
// - Conserva bloqueos (status = 'blocked') desvinculando post_id.
const cleanupExpiredPostRequests = async () => {
  try {
    // 1) Posts a considerar para limpiar solicitudes: expirados (24h) o borrados (soft delete)
    const postsToCleanup = await pool.query(
      `SELECT id
       FROM Post_users
       WHERE created_at < NOW() - ($1 * INTERVAL '1 minute')
          OR deleted_at IS NOT NULL
       ORDER BY id ASC
       LIMIT 1000`
      ,
      [POST_TTL_MINUTES]
    );

    const postIds = (postsToCleanup.rows || []).map(r => r.id).filter(id => Number.isFinite(Number(id)));

    // 2.5) Eliminar media ligado a posts expirados/borrados.
    // Esto hace que las imágenes de publicaciones (Home) y el contenido compartido en canales
    // se retiren automáticamente al expirar el post (24h) o al eliminarlo manualmente.
    if (postIds.length > 0) {
      await deleteUploadedImagesByPostIds(postIds);
      await deletePostEngagementByPostIds(postIds);
      await deleteIntimidadesOpensByPostIds(postIds);
      await deleteChannelDataByPostIds(postIds);
    }

    // 3) Conservar bloqueos: desvincular post_id de solicitudes 'blocked'
    if (postIds.length > 0) {
      await pool.query(
        `DELETE FROM group_join_requests
         WHERE post_id = ANY($1::int[])
           AND status = 'pending'`,
        [postIds]
      ).catch(() => {});

      await pool.query(
        `UPDATE group_join_requests
         SET post_id = NULL
         WHERE post_id = ANY($1::int[]) AND status = 'blocked'`,
        [postIds]
      ).catch(() => {});
    }

    // 4) Limpieza adicional: solicitudes pendientes antiguas (sin post_id) expiradas
    const requestsResult = await pool.query(`
      DELETE FROM group_join_requests
      WHERE post_id IS NULL
        AND status = 'pending'
        AND created_at < NOW() - ($1 * INTERVAL '1 minute')
      RETURNING id
    `, [POST_TTL_MINUTES]);

    if (requestsResult.rowCount > 0) {
      console.log(`🧹 Se eliminaron ${requestsResult.rowCount} solicitudes de grupo expiradas.`);
    }
  } catch (error) {
    console.error('❌ Error al limpiar solicitudes ligadas a posts expirados/borrados:', error);
  }
};

// Iniciar el cron job (ejecutar cada minuto)
const startCleanupJob = () => {
  // Ejecutar inmediatamente al iniciar
  cleanupExpiredPostRequests();
  deleteReviewedAccountSelfies();

  // Configurar intervalo de 1 minuto (60000 ms)
  setInterval(() => {
    cleanupExpiredPostRequests();
    deleteReviewedAccountSelfies();
  }, 60000);
  console.log('⏰ Servicio de limpieza de publicaciones iniciado (verificación cada 1 min)');
};

module.exports = { startCleanupJob };
