const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const raw = req.headers.authorization || '';
  // #region agent log
  console.log('[agent-debug][H1] auth entry', {
    path: req.originalUrl,
    method: req.method,
    hasAuthorization: raw.length > 0,
    bearerPrefix: /^Bearer\s+/i.test(raw),
  });
  // #endregion
  // #region agent log
  fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H1',location:'middleware/auth.js:5',message:'requireAuth entry',data:{path:req.originalUrl,method:req.method,hasAuthorization:raw.length>0,bearerPrefix:/^Bearer\s+/i.test(raw)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    // #region agent log
    console.log('[agent-debug][H1] auth missing/malformed header', {
      path: req.originalUrl,
      method: req.method,
      authorizationPreview: raw ? raw.slice(0, 16) : '',
    });
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H1',location:'middleware/auth.js:9',message:'authorization header missing or malformed',data:{path:req.originalUrl,method:req.method},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev-insecure';
    const payload = jwt.verify(m[1].trim(), secret);
    const userId = payload.userId;
    if (userId == null || !Number.isFinite(Number(userId))) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.userId = Number(userId);
    // #region agent log
    console.log('[agent-debug][H2] jwt verified', {
      path: req.originalUrl,
      method: req.method,
      userId: req.userId,
    });
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H2',location:'middleware/auth.js:21',message:'jwt verified',data:{path:req.originalUrl,method:req.method,userId:req.userId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    next();
  } catch (err) {
    // #region agent log
    console.log('[agent-debug][H2] jwt verify failed', {
      path: req.originalUrl,
      method: req.method,
      errorName: err?.name || null,
      errorMessage: err?.message || null,
    });
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H2',location:'middleware/auth.js:25',message:'jwt verify failed',data:{path:req.originalUrl,method:req.method,errorName:err?.name||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(401).json({ error: '로그인이 만료되었거나 유효하지 않습니다.' });
  }
}

module.exports = { requireAuth };
