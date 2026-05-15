const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getMeUserAndPet } = require('../services/mePayloadService');
const { useInventoryEntry, InventoryUseError } = require('../services/inventoryService');

const router = express.Router();

router.post('/use', requireAuth, async (req, res) => {
  const inventoryEntryId = Number(req.body?.inventoryEntryId);
  if (!Number.isInteger(inventoryEntryId) || inventoryEntryId < 1) {
    return res.status(400).json({
      error: 'INVALID_INVENTORY_ENTRY_ID',
      message: 'inventoryEntryId must be a positive integer.',
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await useInventoryEntry(conn, req.userId, inventoryEntryId);
    await conn.commit();

    const me = await getMeUserAndPet(db, req.userId);
    if (!me) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
    }

    return res.json({
      ok: true,
      message: result.message,
      effects: result.effects,
      user: { stats: me.user.stats },
      inventory: result.inventory,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors when the transaction is already closed.
    }
    if (err instanceof InventoryUseError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('[inventory] POST /inventory/use', err);
    return res.status(500).json({ error: 'ITEM_USE_FAILED', message: 'Failed to use item.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
