const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function ensureRequestedUserMatchesToken(req, res) {
  const requestedUserId = req.method === 'GET' ? req.query.userId : req.body?.userId;
  if (requestedUserId == null || requestedUserId === '') {
    return true;
  }

  const userId = Number(requestedUserId);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: 'INVALID_USER_ID' });
    return false;
  }
  if (userId !== req.userId) {
    res.status(403).json({ error: 'FORBIDDEN_USER' });
    return false;
  }
  return true;
}

/** Vite 프록시용 — /api/health 는 backend 통합 서버 상태를 확인 */
router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      service: 'campus-rpg-backend',
      database: 'up',
      geminiQuestApi: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'configured' : 'missing',
    });
  } catch (e) {
    console.error('[gameApi] GET /health', e);
    res.status(503).json({
      ok: false,
      service: 'campus-rpg-backend',
      database: 'down',
      error: 'DB 연결 실패 — .env 및 MySQL 실행 여부를 확인하세요.',
    });
  }
});

const invSelectSql = `
  SELECT
    ui.item_id AS itemId,
    ui.quantity,
    i.name,
    i.description,
    i.price,
    i.image_url AS imageUrl,
    i.icon_emoji AS iconEmoji,
    i.effect_type AS effectType
  FROM user_inventory ui
  INNER JOIN items i ON i.id = ui.item_id
  WHERE ui.user_id = ?
  ORDER BY ui.id ASC
`;

/** 상점·보관함 공통: 아이템 카탈로그 */
router.get('/items', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, price,
              image_url AS imageUrl, icon_emoji AS iconEmoji, effect_type AS effectType
       FROM items ORDER BY id ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error('[gameApi] GET /items', e);
    res.status(500).json({ error: 'ITEMS_FETCH_FAILED' });
  }
});

/** 보유 코인 */
router.get('/wallet', requireAuth, async (req, res) => {
  // #region agent log
  console.log('[agent-debug][H3] wallet handler reached', {
    queryUserId: req.query.userId ?? null,
    tokenUserId: req.userId ?? null,
  });
  // #endregion
  // #region agent log
  fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H3',location:'routes/gameApi.js:80',message:'wallet route reached after auth',data:{queryUserId:req.query.userId??null,tokenUserId:req.userId??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!ensureRequestedUserMatchesToken(req, res)) {
    // #region agent log
    console.log('[agent-debug][H3] wallet rejected by ensureRequestedUserMatchesToken', {
      queryUserId: req.query.userId ?? null,
      tokenUserId: req.userId ?? null,
    });
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H3',location:'routes/gameApi.js:83',message:'wallet user mismatch or invalid userId',data:{queryUserId:req.query.userId??null,tokenUserId:req.userId??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return;
  }
  const userId = req.userId;
  try {
    const [[row]] = await pool.query('SELECT coin FROM users WHERE id = ?', [userId]);
    if (!row) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    // #region agent log
    console.log('[agent-debug][H4] wallet coin fetched', {
      userId,
      coin: row.coin,
      coinType: typeof row.coin,
    });
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7446/ingest/b8ad1565-784d-4b14-a18f-f677017f34aa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab100e'},body:JSON.stringify({sessionId:'ab100e',runId:'wallet-401-run1',hypothesisId:'H4',location:'routes/gameApi.js:92',message:'wallet coin fetched',data:{userId,coinType:typeof row.coin},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.json({ coin: row.coin });
  } catch (e) {
    console.error('[gameApi] GET /wallet', e);
    res.status(500).json({ error: 'WALLET_FETCH_FAILED' });
  }
});

/** 유저 보관함 (조인 결과) */
router.get('/inventory', requireAuth, async (req, res) => {
  if (!ensureRequestedUserMatchesToken(req, res)) {
    return;
  }
  const userId = req.userId;
  try {
    const [[user]] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    const [rows] = await pool.query(invSelectSql, [userId]);
    res.json(rows);
  } catch (e) {
    console.error('[gameApi] GET /inventory', e);
    res.status(500).json({ error: 'INVENTORY_FETCH_FAILED' });
  }
});

/** 코인 차감 후 보관함에 스택 */
router.post('/inventory/purchase', requireAuth, async (req, res) => {
  if (!ensureRequestedUserMatchesToken(req, res)) {
    return;
  }
  const userId = req.userId;
  const itemId = Number(req.body?.itemId);
  if (!Number.isInteger(itemId) || itemId < 1) {
    return res.status(400).json({ error: 'INVALID_BODY' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query(
      'SELECT id, price FROM items WHERE id = ?',
      [itemId]
    );
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ITEM_NOT_FOUND' });
    }

    const [[userRow]] = await conn.query(
      'SELECT coin FROM users WHERE id = ?',
      [userId]
    );
    if (!userRow) {
      await conn.rollback();
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    if (userRow.coin < item.price) {
      await conn.rollback();
      return res.status(402).json({ error: 'INSUFFICIENT_FUNDS', coin: userRow.coin });
    }

    await conn.query('UPDATE users SET coin = coin - ? WHERE id = ?', [item.price, userId]);

    await conn.query(
      `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, 1)
       ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1`,
      [userId, itemId]
    );

    await conn.commit();

    const [[u2]] = await pool.query('SELECT coin FROM users WHERE id = ?', [userId]);
    const [inventory] = await pool.query(invSelectSql, [userId]);

    res.json({
      coin: u2.coin,
      inventory,
    });
  } catch (e) {
    await conn.rollback();
    console.error('[gameApi] POST /inventory/purchase', e);
    res.status(500).json({ error: 'PURCHASE_FAILED' });
  } finally {
    conn.release();
  }
});

module.exports = router;
