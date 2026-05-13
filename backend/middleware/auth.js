const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const raw = req.headers.authorization || '';
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: '로그인이 필요합니다.', message: 'Authorization Bearer 토큰이 필요합니다.' });
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev-insecure';
    const payload = jwt.verify(m[1].trim(), secret);
    const userId = payload.userId;
    if (userId == null || !Number.isFinite(Number(userId))) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.', message: '토큰 페이로드가 올바르지 않습니다.' });
    }
    req.userId = Number(userId);
    next();
  } catch (err) {
    return res.status(401).json({ error: '로그인이 만료되었거나 유효하지 않습니다.', message: err?.message || 'JWT 검증 실패' });
  }
}

module.exports = { requireAuth };
