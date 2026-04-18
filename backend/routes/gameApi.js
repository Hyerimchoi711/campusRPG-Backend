const express = require('express');
const pool = require('../db');

const router = express.Router();

/** Vite 프록시용 — /api/health 는 5000(backend)으로 연결 (quest-api 8787과 분리) */
router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      service: 'campus-rpg-backend',
      database: 'up',
      geminiQuestApi:
        '퀘스트 LLM 상태는 quest-api 실행 후 http://localhost:8787/api/health (또는 cd server && npm start)',
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
router.get('/wallet', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: 'INVALID_USER_ID' });
  }
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
router.get('/inventory', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: 'INVALID_USER_ID' });
  }
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
router.post('/inventory/purchase', async (req, res) => {
  const userId = Number(req.body?.userId);
  const itemId = Number(req.body?.itemId);
  if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(itemId) || itemId < 1) {
    return res.status(400).json({ error: 'INVALID_BODY' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query(
      'SELECT id, price FROM items WHERE id = ? FOR UPDATE',
      [itemId]
    );
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ITEM_NOT_FOUND' });
    }

    const [[userRow]] = await conn.query(
      'SELECT coin FROM users WHERE id = ? FOR UPDATE',
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
       ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
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
