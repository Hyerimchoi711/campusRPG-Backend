const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const STAT_TYPES = ['health', 'social', 'diligence', 'focus', 'creativity'];
const FATIGUE_RECOVERY_AMOUNT = 10;

function randomStatType() {
  return STAT_TYPES[Math.floor(Math.random() * STAT_TYPES.length)];
}

function randomStatAmount() {
  return Math.floor(Math.random() * 3) + 1;
}

async function applyItemEffect(conn, userId, effectType) {
  switch (effectType) {
    case 'FATIGUE_RECOVERY':
      await conn.query(
        `UPDATE stats
         SET daily_fatigue = CASE
               WHEN daily_fatigue - ? < 0 THEN 0
               ELSE daily_fatigue - ?
             END,
             last_updated_date = date('now')
         WHERE user_id = ?`,
        [FATIGUE_RECOVERY_AMOUNT, FATIGUE_RECOVERY_AMOUNT, userId]
      );
      return { effectType, amount: FATIGUE_RECOVERY_AMOUNT };

    case 'RANDOM_STAT': {
      const statType = randomStatType();
      const amount = randomStatAmount();
      await conn.query(
        `UPDATE stats
         SET ${statType} = ${statType} + ?,
             last_updated_date = date('now')
         WHERE user_id = ?`,
        [amount, userId]
      );
      return { effectType, statType, amount };
    }

    case 'STAT_RESET':
      await conn.query(
        `UPDATE stats
         SET health = 0,
             social = 0,
             diligence = 0,
             focus = 0,
             creativity = 0,
             daily_fatigue = 0,
             last_updated_date = date('now')
         WHERE user_id = ?`,
        [userId]
      );
      return { effectType, amount: 0 };

    default:
      return null;
  }
}

router.post('/use', requireAuth, async (req, res) => {
  const itemId = Number(req.body?.itemId);
  if (!Number.isInteger(itemId) || itemId < 1) {
    return res.status(400).json({ error: 'INVALID_ITEM_ID', message: 'itemId must be a positive integer.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[inventoryItem]] = await conn.query(
      `SELECT
         ui.quantity,
         i.id AS item_id,
         i.effect_type
       FROM user_inventory ui
       INNER JOIN items i ON i.id = ui.item_id
       WHERE ui.user_id = ? AND ui.item_id = ?
       LIMIT 1`,
      [req.userId, itemId]
    );

    if (!inventoryItem || Number(inventoryItem.quantity) < 1) {
      await conn.rollback();
      return res.status(404).json({ error: 'INVENTORY_ITEM_NOT_FOUND', message: 'Inventory item not found.' });
    }

    const [[stats]] = await conn.query('SELECT user_id FROM stats WHERE user_id = ? LIMIT 1', [req.userId]);
    if (!stats) {
      await conn.rollback();
      return res.status(404).json({ error: 'STATS_NOT_FOUND', message: 'Stats not found.' });
    }

    const remainingQuantity = Number(inventoryItem.quantity) - 1;
    if (remainingQuantity > 0) {
      await conn.query(
        `UPDATE user_inventory
         SET quantity = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND item_id = ?`,
        [remainingQuantity, req.userId, itemId]
      );
    } else {
      await conn.query(
        'DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?',
        [req.userId, itemId]
      );
    }

    const appliedEffect = await applyItemEffect(conn, req.userId, inventoryItem.effect_type);

    await conn.commit();
    return res.json({ ok: true, remainingQuantity, appliedEffect });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors if the transaction is already closed.
    }
    console.error('[inventory] POST /inventory/use', err);
    return res.status(500).json({ error: 'ITEM_USE_FAILED', message: 'Failed to use item.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
