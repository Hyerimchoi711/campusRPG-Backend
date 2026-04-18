const cors = require('cors');

/**
 * ALLOWED_ORIGINS: 쉼표로 구분. 비우면 개발 편의상 요청 Origin을 그대로 허용(origin: true).
 * 운영 예: http://localhost:5173,https://myapp.vercel.app
 */
function createCorsMiddleware() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw == null || String(raw).trim() === '') {
    return cors({ origin: true, credentials: true });
  }
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, list.includes(origin));
    },
    credentials: true,
  });
}

module.exports = { createCorsMiddleware };
