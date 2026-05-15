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
    res.status(400).json({ error: 'INVALID_USER_ID', message: '유효한 userId가 필요합니다.' });
    return false;
  }
  if (userId !== req.userId) {
    res.status(403).json({ error: 'FORBIDDEN_USER', message: '토큰 사용자와 일치하지 않는 userId입니다.' });
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

const { listInventory } = require('../services/inventoryService');

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
  if (!ensureRequestedUserMatchesToken(req, res)) {
    return;
  }
  const userId = req.userId;
  try {
    const [[row]] = await pool.query('SELECT coin FROM users WHERE id = ?', [userId]);
    if (!row) return res.status(404).json({ error: 'USER_NOT_FOUND' });
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
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    const rows = await listInventory(pool, userId);
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
    return res.status(400).json({ error: 'INVALID_BODY', message: 'itemId는 1 이상의 정수여야 합니다.' });
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
      return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: '아이템을 찾을 수 없습니다.' });
    }

    const [[userRow]] = await conn.query(
      'SELECT coin FROM users WHERE id = ?',
      [userId]
    );
    if (!userRow) {
      await conn.rollback();
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }
    if (Number(userRow.coin) < item.price) {
      await conn.rollback();
      return res.status(402).json({ error: 'INSUFFICIENT_FUNDS', message: '코인이 부족합니다.', coin: Number(userRow.coin) });
    }

    await conn.query('UPDATE users SET coin = coin - ? WHERE id = ?', [item.price, userId]);

    await conn.query(
      `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, 1)
       ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 1`,
      [userId, itemId]
    );

    await conn.commit();

    const [[u2]] = await pool.query('SELECT coin FROM users WHERE id = ?', [userId]);
    const inventory = await listInventory(pool, userId);

    res.json({
      coin: Number(u2.coin),
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
