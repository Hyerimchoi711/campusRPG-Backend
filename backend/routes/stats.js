const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function toStatsResponse(row) {
  return {
    health: row.health,
    social: row.social,
    diligence: row.diligence,
    focus: row.focus,
    creativity: row.creativity,
    dailyFatigue: row.daily_fatigue,
    daily_fatigue: row.daily_fatigue,
    lastUpdatedDate: row.last_updated_date,
    last_updated_date: row.last_updated_date,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT health, social, diligence, focus, creativity, daily_fatigue, last_updated_date
       FROM stats
       WHERE user_id = ?
       LIMIT 1`,
      [req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'STATS_NOT_FOUND', message: 'Stats not found.' });
    }

    return res.json(toStatsResponse(rows[0]));
  } catch (err) {
    console.error('[stats] GET /stats', err);
    return res.status(500).json({ error: 'STATS_FETCH_FAILED', message: 'Failed to fetch stats.' });
  }
});

module.exports = router;
