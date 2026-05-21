const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { questLlmService } = require('../services/questLlmService');

const router = express.Router();

router.post('/quests/generate', requireAuth, async (req, res) => {
  if (!questLlmService.isConfigured()) {
    return res.status(503).json({ error: 'GEMINI_API_KEY_MISSING' });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : undefined;
  const userId = req.userId;

  const conn = await pool.getConnection();
  try {
    const [userRows] = await pool.query(
      `SELECT id, nickname, major, university_name, school_year, intro
       FROM users
       WHERE id = ?`,
      [userId]
    );
    const user = userRows[0];
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const result = await questLlmService.generateQuests(conn, userId, user, prompt, context);
    return res.json(result);
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors when the transaction was not opened.
    }

    console.error('[questLlm] POST /quests/generate', e);
    if (e.statusCode === 429 || e.message === 'GEMINI_RATE_LIMIT') {
      return res.status(429).json({ error: 'GEMINI_RATE_LIMIT' });
    }
    if (String(e.message || '').startsWith('INVALID_LLM_') || e.message === 'LLM_QUESTS_NOT_FOUND') {
      return res.status(502).json({ error: 'INVALID_LLM_RESPONSE' });
    }
    return res.status(500).json({ error: 'QUEST_GENERATION_FAILED' });
  } finally {
    conn.release();
  }
});

module.exports = router;
