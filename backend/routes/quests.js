const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TYPES = new Set(['DAILY', 'WEEKLY']);
const { applyQuestReward, ensureStatsRow } = require('../services/questRewardEngine');

function questSourceFromRow(row) {
  return Number(row.for_roll_pool) === 0 ? 'llm' : 'default';
}

/** user_quests 배정 퀘스트 (맞춤 LLM + 레거시). 슬롯 롤은 GET /api/me/quests/current 사용. */
function toApiQuest(row) {
  const questSource = questSourceFromRow(row);
  const isLlm = questSource === 'llm';
  return {
    id: row.id,
    title: row.title,
    description: null,
    type: row.type,
    completed: Boolean(row.is_completed),
    progress: 0,
    coinReward: isLlm ? 0 : Number(row.reward_coin) || 0,
    expReward: Number(row.reward_exp) || 0,
    rewardStatType: row.reward_stat_type,
    rewardStatAmount: Number(row.reward_stat_amount) || 0,
    questSource,
  };
}

/** user_quests 기반 목록 (맞춤 LLM: for_roll_pool=0, questSource=llm) */
router.get('/quests', requireAuth, async (req, res) => {
  const type = String(req.query?.type || 'DAILY').trim().toUpperCase();
  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'INVALID_QUEST_TYPE' });
  }

  const source = String(req.query?.source || '').trim().toLowerCase();
  let poolFilter = '';
  if (source === 'llm') {
    poolFilter = ' AND q.for_roll_pool = 0';
  } else if (source === 'default') {
    poolFilter = ' AND q.for_roll_pool = 1';
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         q.id,
         q.title,
         q.type,
         q.reward_exp,
         q.reward_coin,
         q.reward_stat_type,
         q.reward_stat_amount,
         q.for_roll_pool,
         uq.is_completed,
         uq.assigned_date
       FROM user_quests uq
       INNER JOIN quests q ON q.id = uq.quest_id
       WHERE uq.user_id = ? AND q.type = ?${poolFilter}
       ORDER BY uq.assigned_date DESC, uq.id ASC`,
      [req.userId, type]
    );

    return res.json(rows.map(toApiQuest));
  } catch (e) {
    console.error('[quests] GET /quests', e);
    return res.status(500).json({ error: 'QUESTS_FETCH_FAILED' });
  }
});

/** 맞춤·레거시 퀘스트 완료 (슬롯 롤과 무관). 보상은 questRewardEngine(기본 퀘스트와 동일 규칙). */
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
         q.reward_stat_amount,
         q.for_roll_pool
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

    const isLlm = Number(quest.for_roll_pool) === 0;
    if (isLlm && Number(quest.reward_coin) !== 0) {
      await conn.query('UPDATE quests SET reward_coin = 0 WHERE id = ?', [quest.id]);
      quest.reward_coin = 0;
    }

    await conn.query('UPDATE user_quests SET is_completed = 1 WHERE id = ?', [quest.user_quest_id]);
    await ensureStatsRow(conn, req.userId);
    const r = await applyQuestReward(conn, req.userId, quest);

    await conn.commit();
    return res.json({
      ok: true,
      rewards: {
        coin: isLlm ? 0 : r.coin,
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
