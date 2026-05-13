const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  getCurrentQuestSet,
  patchDailySlot,
  patchWeeklySlot,
} = require('../services/questRollService');

const router = express.Router();

router.get('/quests/current', requireAuth, async (req, res) => {
  try {
    const data = await getCurrentQuestSet(db, req.userId);
    return res.json({
      rollDate: data.rollDate,
      weekId: data.weekId,
      daily: data.daily,
      weekly: data.weekly,
    });
  } catch (e) {
    console.error('[meQuests] GET /quests/current', e);
    return res.status(500).json({ error: 'QUEST_CURRENT_FAILED', message: e.message || '퀘스트 조회에 실패했습니다.' });
  }
});

router.patch('/quests/daily', requireAuth, async (req, res) => {
  const slot = Number(req.body?.slot);
  const completed = Boolean(req.body?.completed);
  if (!Number.isInteger(slot)) {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'slot은 정수여야 합니다.' });
  }
  try {
    const result = await patchDailySlot(db, req.userId, slot, completed);
    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error('[meQuests] PATCH /quests/daily', e);
    return res.status(500).json({ error: 'QUEST_PATCH_FAILED', message: '일일 퀘스트 갱신에 실패했습니다.' });
  }
});

router.patch('/quests/weekly', requireAuth, async (req, res) => {
  const slot = Number(req.body?.slot);
  const completed = Boolean(req.body?.completed);
  if (!Number.isInteger(slot)) {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'slot은 정수여야 합니다.' });
  }
  try {
    const result = await patchWeeklySlot(db, req.userId, slot, completed);
    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error('[meQuests] PATCH /quests/weekly', e);
    return res.status(500).json({ error: 'QUEST_PATCH_FAILED', message: '주간 퀘스트 갱신에 실패했습니다.' });
  }
});

module.exports = router;
