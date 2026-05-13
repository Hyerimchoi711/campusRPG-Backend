const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TYPES = new Set(['DAILY', 'WEEKLY']);
const { applyQuestReward, ensureStatsRow } = require('../services/questRewardEngine');

/** @deprecated Prefer GET /api/me/quests/current + PATCH /api/me/quests/daily|weekly */
function toApiQuest(row) {
  return {
    id: row.id,
    title: row.title,
    description: null,
    type: row.type,
    completed: Boolean(row.is_completed),
    progress: 0,
    coinReward: Number(row.reward_coin) || 0,
    expReward: Number(row.reward_exp) || 0,
  };
}

/** @deprecated 레거시: user_quests 기반 목록 (슬롯 롤과 무관) */
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
         q.reward_exp,
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

/** @deprecated 레거시: POST 완료 (슬롯 롤과 무관). 신규는 PATCH /api/me/quests/daily|weekly */
router.post('/quests/:id/complete', requireAuth, async (req, res) => {
  const questId = Number(req.params.id);
  if (!Number.isInteger(questId) || questId < 1) {
    return res.status(400).json({ error: 'INVALID_QUEST_ID' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [qrows] = await conn.query(
      `SELECT
         uq.id AS user_quest_id,
         uq.is_completed,
         q.id,
         q.reward_exp,
         q.reward_coin,
         q.reward_stat_type,
         q.reward_stat_amount
       FROM user_quests uq
       INNER JOIN quests q ON q.id = uq.quest_id
       WHERE uq.user_id = ? AND q.id = ?
       LIMIT 1`,
      [req.userId, questId]
    );
    const quest = qrows[0];

    if (!quest) {
      await conn.rollback();
      return res.status(404).json({ error: 'QUEST_NOT_FOUND' });
    }
    if (quest.is_completed) {
      await conn.rollback();
      return res.status(409).json({ error: 'QUEST_ALREADY_COMPLETED' });
    }

    await conn.query('UPDATE user_quests SET is_completed = 1 WHERE id = ?', [quest.user_quest_id]);
    await ensureStatsRow(conn, req.userId);
    const r = await applyQuestReward(conn, req.userId, quest);

    await conn.commit();
    return res.json({
      ok: true,
      rewards: {
        coin: r.coin,
        exp: r.exp,
        statType: r.statType,
        statAmount: r.statAmount,
        fatigue: r.fatigue,
      },
      levelUp: r.levelUp,
      evolved: r.evolved,
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
