const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TYPES = new Set(['DAILY', 'WEEKLY']);
const ALLOWED_STATS = new Set(['health', 'social', 'diligence', 'focus', 'creativity']);
const DEFAULT_FATIGUE_REWARD = 1;

function toApiQuest(row) {
  return {
    id: row.id,
    title: row.title,
    description: null,
    type: row.type,
    completed: Boolean(row.is_completed),
    progress: 0,
    coinReward: row.reward_coin,
    expReward: 0,
  };
}

router.get('/quests', requireAuth, async (req, res) => {
  const type = String(req.query?.type || 'DAILY').trim().toUpperCase();
  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'INVALID_QUEST_TYPE' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         q.id,
         q.title,
         q.type,
         q.reward_coin,
         uq.is_completed,
         uq.assigned_date
       FROM user_quests uq
       INNER JOIN quests q ON q.id = uq.quest_id
       WHERE uq.user_id = ? AND q.type = ?
       ORDER BY uq.assigned_date DESC, uq.id ASC`,
      [req.userId, type]
    );

    return res.json(rows.map(toApiQuest));
  } catch (e) {
    console.error('[quests] GET /quests', e);
    return res.status(500).json({ error: 'QUESTS_FETCH_FAILED' });
  }
});

router.post('/quests/:id/complete', requireAuth, async (req, res) => {
  const questId = Number(req.params.id);
  if (!Number.isInteger(questId) || questId < 1) {
    return res.status(400).json({ error: 'INVALID_QUEST_ID' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[quest]] = await conn.query(
      `SELECT
         uq.id AS user_quest_id,
         uq.is_completed,
         q.id,
         q.reward_coin,
         q.reward_stat_type,
         q.reward_stat_amount
       FROM user_quests uq
       INNER JOIN quests q ON q.id = uq.quest_id
       WHERE uq.user_id = ? AND q.id = ?
       LIMIT 1`,
      [req.userId, questId]
    );

    if (!quest) {
      await conn.rollback();
      return res.status(404).json({ error: 'QUEST_NOT_FOUND' });
    }
    if (quest.is_completed) {
      await conn.rollback();
      return res.status(409).json({ error: 'QUEST_ALREADY_COMPLETED' });
    }

    const coin = Number(quest.reward_coin) || 0;
    const exp = 0;
    const fatigue = DEFAULT_FATIGUE_REWARD;
    const statType = String(quest.reward_stat_type || '').trim();
    const statAmount = Number(quest.reward_stat_amount) || 0;

    await conn.query(
      'UPDATE user_quests SET is_completed = 1 WHERE id = ?',
      [quest.user_quest_id]
    );
    await conn.query(
      'UPDATE users SET coin = coin + ?, exp = exp + ? WHERE id = ?',
      [coin, exp, req.userId]
    );

    if (ALLOWED_STATS.has(statType) && statAmount > 0) {
      await conn.query(
        `UPDATE stats
         SET ${statType} = ${statType} + ?,
             daily_fatigue = daily_fatigue + ?,
             last_updated_date = date('now')
         WHERE user_id = ?`,
        [statAmount, fatigue, req.userId]
      );
    } else {
      await conn.query(
        `UPDATE stats
         SET daily_fatigue = daily_fatigue + ?,
             last_updated_date = date('now')
         WHERE user_id = ?`,
        [fatigue, req.userId]
      );
    }

    await conn.commit();
    return res.json({
      ok: true,
      rewards: {
        coin,
        exp,
        fatigue,
      },
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors when the transaction was already closed.
    }
    console.error('[quests] POST /quests/:id/complete', e);
    return res.status(500).json({ error: 'QUEST_COMPLETE_FAILED' });
  } finally {
    conn.release();
  }
});

module.exports = router;
