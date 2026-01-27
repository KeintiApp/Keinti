const DEFAULT_POST_TTL_MINUTES = 24 * 60;

function getPostTtlMinutes() {
  const raw = process.env.POST_TTL_MINUTES;
  const n = Number(raw);
  if (!raw) return DEFAULT_POST_TTL_MINUTES;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_POST_TTL_MINUTES;
  return Math.floor(n);
}

module.exports = {
  DEFAULT_POST_TTL_MINUTES,
  getPostTtlMinutes,
};
